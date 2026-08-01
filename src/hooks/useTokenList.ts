import { useQuery } from '@tanstack/react-query'
import { getSwappableTokens, lookupCustomToken } from '../services/tokenRegistry'
import { getBridgeableTokens } from '../config/bridgeableAssets'

const TOKEN_LIST_STALE_TIME_MS = 5 * 60 * 1000 // 5 minutes
const CUSTOM_TOKEN_STALE_TIME_MS = 30_000

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

/**
 * Two distinct token lists, matching the Swap-mode vs Bridge-mode distinction:
 * Swap mode needs every liquid token (LI.FI-backed, includes memecoins nothing
 * bridges); Bridge mode needs only the narrow hand-maintained bridgeable set.
 */
export const useTokenList = (chainId: number | undefined, mode: 'swap' | 'bridge') => {
  return useQuery({
    queryKey: ['tokenList', mode, chainId],
    queryFn: async () => (mode === 'swap' ? getSwappableTokens(chainId!) : getBridgeableTokens(chainId!)),
    enabled: chainId !== undefined,
    staleTime: TOKEN_LIST_STALE_TIME_MS,
  })
}

export const useCustomTokenLookup = (chainId: number | undefined, address: string | undefined) => {
  return useQuery({
    queryKey: ['customTokenLookup', chainId, address],
    queryFn: () => lookupCustomToken(chainId!, address!),
    enabled: chainId !== undefined && address !== undefined && ADDRESS_RE.test(address),
    staleTime: CUSTOM_TOKEN_STALE_TIME_MS,
  })
}
