import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getQuotes, NoRouteError } from '../services/quoteEngine'
import { ALL_AGGREGATORS } from '../services/aggregators'
import type { Quote, QuoteRequest } from '../services/aggregators/types'

/** Debounces `value`, only updating the returned value after `delayMs` of quiet. */
const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

const QUOTE_DEBOUNCE_MS = 400
const QUOTE_REFETCH_INTERVAL_MS = 20_000

/**
 * Fetches quotes for a `QuoteRequest`, debounced by 400ms so rapid edits
 * (e.g. typing an amount) don't fire a getQuotes call per keystroke.
 *
 * A `null` request (e.g. before both tokens are picked) never fires. Every
 * field of the request is part of the queryKey, so changing any one of them
 * produces a fresh cache entry / refetch - stale responses for an old key
 * only ever update that old cache entry, never the current one, so no
 * manual request-cancellation bookkeeping is needed here.
 */
export const useQuote = (request: QuoteRequest | null) => {
  const debouncedRequest = useDebouncedValue(request, QUOTE_DEBOUNCE_MS)

  const query = useQuery({
    queryKey: [
      'quote',
      debouncedRequest?.fromChainId,
      debouncedRequest?.toChainId,
      debouncedRequest?.fromToken,
      debouncedRequest?.toToken,
      debouncedRequest?.amount,
      debouncedRequest?.fromAddress,
      debouncedRequest?.slippageBps,
    ],
    queryFn: () => getQuotes(debouncedRequest as QuoteRequest, ALL_AGGREGATORS),
    enabled: debouncedRequest !== null,
    refetchInterval: QUOTE_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  })

  const quotes: Quote[] = query.data?.quotes ?? []
  const failures = query.data?.failures ?? []
  const bestQuote = quotes[0] ?? null

  // 'unsupported-pair': no aggregator even claims to support this chain
  // combination - a structurally missing route, not a liquidity problem.
  // 'no-liquidity': aggregators were tried and all came back empty/failed.
  // null: no error, or a request hasn't settled/fired yet.
  const noRouteReason: 'unsupported-pair' | 'no-liquidity' | null =
    query.error instanceof NoRouteError ? query.error.reason : query.error ? 'no-liquidity' : null

  return {
    ...query,
    quotes,
    failures,
    bestQuote,
    noRouteReason,
    isLoading: query.isLoading,
    error: query.error,
  }
}
