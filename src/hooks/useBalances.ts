import { useQuery } from '@tanstack/react-query'
import { fetchBalances, discoverHeldTokens } from '../services/balances'

const HELD_TOKENS_STALE_TIME_MS = 15_000
const HELD_TOKENS_REFETCH_INTERVAL_MS = 30_000
const TOKEN_BALANCES_STALE_TIME_MS = 10_000

/**
 * Which tokens a wallet actually holds, for populating the "your tokens" list
 * in the swap picker. Polled on an interval so the list stays reasonably
 * fresh as balances move, without the user manually refreshing.
 */
export const useHeldTokens = (chainId: number | undefined, ownerAddress: string | undefined) => {
  return useQuery({
    queryKey: ['heldTokens', chainId, ownerAddress],
    queryFn: () => discoverHeldTokens(chainId!, ownerAddress!),
    enabled: chainId !== undefined && ownerAddress !== undefined,
    staleTime: HELD_TOKENS_STALE_TIME_MS,
    refetchInterval: HELD_TOKENS_REFETCH_INTERVAL_MS,
  })
}

/**
 * Raw balances for a specific set of tokens. tokenAddresses is sorted before
 * being placed in the queryKey so that requesting [a, b] and [b, a] hit the
 * same cache entry rather than producing two separate queries for what's
 * functionally the same request.
 */
export const useTokenBalances = (
  chainId: number | undefined,
  ownerAddress: string | undefined,
  tokenAddresses: string[]
) => {
  const sortedTokenAddresses = [...tokenAddresses].sort()

  return useQuery({
    queryKey: ['tokenBalances', chainId, ownerAddress, sortedTokenAddresses],
    queryFn: () => fetchBalances(chainId!, ownerAddress!, sortedTokenAddresses),
    enabled: chainId !== undefined && ownerAddress !== undefined && tokenAddresses.length > 0,
    staleTime: TOKEN_BALANCES_STALE_TIME_MS,
  })
}
