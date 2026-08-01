import { useQuery } from '@tanstack/react-query'
import { getSwappableTokens, lookupCustomToken } from '../services/tokenRegistry'
import type { Token } from '../services/tokenRegistry'
import { getBridgeableTokens } from '../config/bridgeableAssets'

const TOKEN_LIST_STALE_TIME_MS = 5 * 60 * 1000 // 5 minutes
const CUSTOM_TOKEN_STALE_TIME_MS = 30_000

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

/**
 * getBridgeableTokens only returns {symbol, address, decimals} - it has no
 * chainId/name/logoURI, since bridgeableAssets.ts is a plain hardcoded map,
 * not something fetched per-chain the way LI.FI's token list is. Mapped into
 * the same Token shape getSwappableTokens returns so useTokenList's result is
 * uniformly Token[] regardless of mode - consumers (TokenSelectModal, etc.)
 * shouldn't need to know which branch produced a given token. `name` falls
 * back to `symbol` (bridgeableAssets has no display name), `logoURI` is left
 * undefined (TokenIcon already falls back to an initials badge for that).
 */
const toToken = (chainId: number, entry: { symbol: string; address: string; decimals: number }): Token => ({
  chainId,
  address: entry.address,
  symbol: entry.symbol,
  name: entry.symbol,
  decimals: entry.decimals,
})

/**
 * Two distinct token lists, matching the Swap-mode vs Bridge-mode distinction:
 * Swap mode needs every liquid token (LI.FI-backed, includes memecoins nothing
 * bridges); Bridge mode needs only the narrow hand-maintained bridgeable set.
 */
export const useTokenList = (chainId: number | undefined, mode: 'swap' | 'bridge') => {
  return useQuery({
    queryKey: ['tokenList', mode, chainId],
    queryFn: async (): Promise<Token[]> =>
      mode === 'swap'
        ? getSwappableTokens(chainId!)
        : getBridgeableTokens(chainId!).map(entry => toToken(chainId!, entry)),
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
