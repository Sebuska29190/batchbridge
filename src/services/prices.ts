const LIFI_PROXY_BASE = '/api/lifi'
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex/tokens'

const CACHE_TTL_MS = 60_000

interface CacheEntry {
  price: number | null
  cachedAt: number
}

const priceCache = new Map<string, CacheEntry>()

// Numeric chainId -> DexScreener chain slug. Only chains we're confident of
// DexScreener's exact slug for are listed; anything missing here falls
// through to returning null from the DexScreener fallback.
const DEXSCREENER_CHAIN_SLUGS: Record<number, string> = {
  1: 'ethereum',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  56: 'bsc',
  8453: 'base',
}

const fetchLifiPrice = async (chainId: number, tokenAddress: string): Promise<number | null> => {
  try {
    const response = await fetch(`${LIFI_PROXY_BASE}/token?chain=${chainId}&token=${tokenAddress}`)
    if (!response.ok) return null
    const data = await response.json()
    const price = parseFloat(data?.priceUSD)
    return Number.isFinite(price) ? price : null
  } catch {
    return null
  }
}

const fetchDexScreenerPrice = async (chainId: number, tokenAddress: string): Promise<number | null> => {
  const slug = DEXSCREENER_CHAIN_SLUGS[chainId]
  if (!slug) return null

  try {
    const response = await fetch(`${DEXSCREENER_BASE}/${tokenAddress}`)
    if (!response.ok) return null
    const data = await response.json()
    const pairs = Array.isArray(data?.pairs) ? data.pairs.filter((p: any) => p.chainId === slug) : []
    if (pairs.length === 0) return null

    const bestPair = pairs.reduce((best: any, pair: any) =>
      (pair.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? pair : best
    )
    const price = parseFloat(bestPair.priceUsd)
    return Number.isFinite(price) ? price : null
  } catch {
    return null
  }
}

/**
 * Gets a token's USD price. Tries LI.FI first, falls back to DexScreener
 * (highest-liquidity matching pair) if LI.FI has no price for that token.
 * Returns null if both sources fail. Results are cached in-memory for 60s
 * (prices go stale fast, no need to persist across page loads).
 */
export const getTokenPrice = async (chainId: number, tokenAddress: string): Promise<number | null> => {
  const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`
  const cached = priceCache.get(cacheKey)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.price
  }

  let price = await fetchLifiPrice(chainId, tokenAddress)
  if (price === null) {
    price = await fetchDexScreenerPrice(chainId, tokenAddress)
  }

  priceCache.set(cacheKey, { price, cachedAt: Date.now() })
  return price
}
