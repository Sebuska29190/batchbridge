import type { Aggregator, Quote, QuoteRequest } from './aggregators/types'

export interface QuoteFailure {
  aggregator: string
  error: string
}

export interface QuoteEngineResult {
  /** Sorted by netOutputUsd, best first. */
  quotes: Quote[]
  failures: QuoteFailure[]
}

/**
 * Distinguishes "nobody even supports this chain pair" from "aggregators
 * tried and found nothing" - the UI shows a different message for each (see
 * SwapCard/BridgeCard's `noRouteReason`).
 */
export class NoRouteError extends Error {
  constructor(public readonly reason: 'unsupported-pair' | 'no-liquidity', message: string) {
    super(message)
    this.name = 'NoRouteError'
  }
}

const AGGREGATOR_TIMEOUT_MS = 8000

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`timed out after ${ms}ms`))
    }, ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason)

/**
 * Filters aggregators to those that can actually serve this request, then
 * races them in parallel. A single aggregator failing or timing out (8s) is
 * recorded in `failures` and doesn't block the others — only when every
 * eligible aggregator fails does this throw, with every reason listed so the
 * caller can tell "no liquidity anywhere" apart from "every provider is down".
 */
export const getQuotes = async (
  req: QuoteRequest,
  aggregators: Aggregator[],
): Promise<QuoteEngineResult> => {
  const isCrossChain = req.fromChainId !== req.toChainId

  const eligible = aggregators.filter(
    (a) =>
      a.supportsChain(req.fromChainId) &&
      a.supportsChain(req.toChainId) &&
      (!isCrossChain || a.supportsCrossChain),
  )

  if (eligible.length === 0) {
    throw new NoRouteError(
      'unsupported-pair',
      `No aggregator supports a route between chain ${req.fromChainId} and ${req.toChainId}.`,
    )
  }

  const settled = await Promise.allSettled(
    eligible.map((a) => withTimeout(a.getQuote(req), AGGREGATOR_TIMEOUT_MS)),
  )

  const quotes: Quote[] = []
  const failures: QuoteFailure[] = []

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      quotes.push(result.value)
    } else {
      failures.push({ aggregator: eligible[i].id, error: errorMessage(result.reason) })
    }
  })

  quotes.sort((a, b) => b.netOutputUsd - a.netOutputUsd)

  if (quotes.length === 0) {
    const reasons = failures.map((f) => `${f.aggregator}: ${f.error}`).join('; ')
    throw new NoRouteError('no-liquidity', `No quotes available from any aggregator. ${reasons}`)
  }

  return { quotes, failures }
}
