import { useQuery } from '@tanstack/react-query'
import { getMultiInputQuote } from '../services/batchQuote'

export interface BatchQuoteOrigin {
  chainId: number
  currency: string
  amount: string // wei
}

export interface BatchQuoteRequest {
  user: string
  origins: BatchQuoteOrigin[]
  destinationChainId: number
  destinationCurrency: string
  slippageBps?: number | null
}

/**
 * Batch mode (mostkowanie wielu tokenów jedną operacją) only has a Relay
 * implementation - LI.FI, Rubic, and ParaSwap have no multi-input equivalent,
 * so unlike useQuote this doesn't race multiple aggregators. Wraps
 * services/batchQuote.ts's getMultiInputQuote (Relay's own /execute/swap/
 * multi-input endpoint, not yet migrated onto the aggregator interface since
 * there's nothing else to unify it with).
 */
export const useBatchQuote = (request: BatchQuoteRequest | null) => {
  return useQuery({
    queryKey: [
      'batchQuote',
      request?.user,
      request?.origins,
      request?.destinationChainId,
      request?.destinationCurrency,
      request?.slippageBps,
    ],
    queryFn: () =>
      getMultiInputQuote({
        user: request!.user,
        recipient: request!.user,
        origins: request!.origins,
        destinationChainId: request!.destinationChainId,
        destinationCurrency: request!.destinationCurrency,
        slippageTolerance: request!.slippageBps != null ? request!.slippageBps / 100 : null,
      }),
    enabled: request !== null && request.origins.length > 0,
    staleTime: 15_000,
  })
}
