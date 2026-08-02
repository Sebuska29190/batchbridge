import { buildRelayError } from './execution'

const RELAY_API_BASE = 'https://api.relay.link'

export interface MultiInputOrigin {
  chainId: number
  currency: string
  amount: string
}

export interface GetMultiInputQuoteParams {
  user: string
  origins: MultiInputOrigin[]
  destinationChainId: number
  destinationCurrency: string
  recipient?: string
  slippageTolerance?: number | null
  explicitDeposit?: boolean
  useFallbacks?: boolean
  useExternalLiquidity?: boolean
  partial?: boolean
}

/** Relay's multi-input quote/execute response - only the fields this codebase actually reads are typed, the rest passes through untouched. */
export interface MultiInputQuoteResult {
  details?: {
    currencyOut?: {
      amountFormatted?: string
      amountUsd?: string
    }
  }
  steps?: unknown[]
  [key: string]: unknown
}

interface MultiInputRequestBody {
  user: string
  origins: MultiInputOrigin[]
  destinationChainId: number
  destinationCurrency: string
  recipient: string
  tradeType: 'EXACT_INPUT'
  referrer: string
  useDepositAddress: boolean
  topupGas: boolean
  explicitDeposit?: boolean
  slippageTolerance?: string
  useFallbacks?: boolean
  useExternalLiquidity?: boolean
  partial?: boolean
}

/**
 * Batch mode's only quote source - Relay's multi-input endpoint, which
 * consolidates several origin tokens (same chain) into one destination
 * token/chain in a single quote. No other aggregator has an equivalent, so
 * unlike quoteEngine.ts this doesn't race multiple providers.
 */
export const getMultiInputQuote = async ({
  user,
  origins,
  destinationChainId,
  destinationCurrency,
  recipient,
  slippageTolerance = null,
  explicitDeposit = true,
  useFallbacks = false,
  useExternalLiquidity = false,
  partial = false,
}: GetMultiInputQuoteParams): Promise<MultiInputQuoteResult> => {
  const requestBody: MultiInputRequestBody = {
    user,
    origins: origins.map((o) => ({
      chainId: Number(o.chainId),
      currency: o.currency,
      amount: o.amount,
    })),
    destinationChainId: Number(destinationChainId),
    destinationCurrency,
    recipient: recipient || user,
    tradeType: 'EXACT_INPUT',
    referrer: 'relay.link',
    useDepositAddress: false,
    topupGas: false,
  }

  if (explicitDeposit !== null && explicitDeposit !== undefined) {
    requestBody.explicitDeposit = explicitDeposit
  }
  if (slippageTolerance !== null) {
    requestBody.slippageTolerance = String(slippageTolerance)
  }
  if (useFallbacks) {
    requestBody.useFallbacks = true
  }
  if (useExternalLiquidity) {
    requestBody.useExternalLiquidity = true
  }
  if (partial) {
    requestBody.partial = true
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(`${RELAY_API_BASE}/execute/swap/multi-input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw await buildRelayError(response, `Multi-input quote failed: ${response.status}`)
    }

    return (await response.json()) as MultiInputQuoteResult
  } catch (fetchError) {
    clearTimeout(timeoutId)
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw fetchError
  }
}
