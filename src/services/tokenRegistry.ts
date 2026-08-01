import { createPublicClient, http, erc20Abi } from 'viem'
import { getChainConfig } from '../config/chains'

const LIFI_PROXY_BASE = '/api/lifi'
const DEXSCREENER_BASE = 'https://api.dexscreener.com'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
const LOW_LIQUIDITY_THRESHOLD_USD = 10000

export interface Token {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  priceUsd?: number
  lowLiquidity?: boolean
}

/**
 * Our numeric chainId -> DexScreener's own chain slug. Verified empirically
 * against https://api.dexscreener.com/latest/dex/tokens/{address} for a known
 * token on each chain (2026-08-01) — DexScreener's slugs don't always match
 * the chain's common name (e.g. Gnosis is "gnosischain", not "gnosis").
 */
const DEXSCREENER_CHAIN_SLUGS: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  56: 'bsc',
  100: 'gnosischain',
  137: 'polygon',
  250: 'fantom',
  324: 'zksync',
  5000: 'mantle',
  8453: 'base',
  34443: 'mode',
  42161: 'arbitrum',
  42220: 'celo',
  43114: 'avalanche',
  59144: 'linea',
  81457: 'blast',
  534352: 'scroll',
}

interface LifiTokenEntry {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
  priceUSD?: string
  logoURI?: string
}

interface LifiTokensResponse {
  tokens: Record<string, LifiTokenEntry[]>
}

const cacheKey = (chainId: number): string => `token-registry:${chainId}`

const readCache = (chainId: number): Token[] | null => {
  try {
    const raw = localStorage.getItem(cacheKey(chainId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { timestamp: number; tokens: Token[] }
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null
    return parsed.tokens
  } catch {
    return null
  }
}

const writeCache = (chainId: number, tokens: Token[]): void => {
  try {
    localStorage.setItem(cacheKey(chainId), JSON.stringify({ timestamp: Date.now(), tokens }))
  } catch {
    // localStorage unavailable (e.g. private browsing) — skip caching.
  }
}

const mapLifiEntry = (entry: LifiTokenEntry): Token => ({
  chainId: entry.chainId,
  address: entry.address,
  symbol: entry.symbol,
  name: entry.name,
  decimals: entry.decimals,
  logoURI: entry.logoURI,
  priceUsd: entry.priceUSD !== undefined ? parseFloat(entry.priceUSD) || undefined : undefined,
})

/**
 * Every token LI.FI can route to/from on the given chain — this is our
 * "liquid enough to swap" source of truth for the Swap-mode destination
 * picker, where the destination token can be any liquid token on the
 * destination chain (not just a small curated bridgeable set).
 */
export const getSwappableTokens = async (chainId: number): Promise<Token[]> => {
  const cached = readCache(chainId)
  if (cached) return cached

  const response = await fetch(`${LIFI_PROXY_BASE}/tokens?chains=${chainId}`)
  if (!response.ok) {
    throw new Error(`LI.FI tokens lookup failed: ${response.status}`)
  }

  const data = (await response.json()) as LifiTokensResponse
  // The top-level key is the chainId as a STRING, even for a single-chain request.
  const entries = data.tokens?.[String(chainId)] ?? []
  const tokens = entries.map(mapLifiEntry)

  writeCache(chainId, tokens)
  return tokens
}

interface DexScreenerPair {
  chainId: string
  baseToken: { address: string }
  quoteToken: { address: string }
  priceUsd?: string
  priceNative?: string
  liquidity?: { usd?: number }
}

interface DexScreenerTokensResponse {
  pairs: DexScreenerPair[] | null
}

/** Highest-liquidity matching pair's USD price and liquidity, or null if none match. */
const bestMatchingPair = (
  pairs: DexScreenerPair[],
  chainSlug: string,
  address: string
): { liquidityUsd: number; priceUsd?: number } | null => {
  const lowerAddress = address.toLowerCase()
  const matching = pairs.filter(p => p.chainId === chainSlug)

  let best: { liquidityUsd: number; priceUsd?: number } | null = null
  for (const pair of matching) {
    const liquidityUsd = pair.liquidity?.usd ?? 0
    if (best !== null && liquidityUsd <= best.liquidityUsd) continue

    let priceUsd: number | undefined
    if (pair.baseToken.address.toLowerCase() === lowerAddress) {
      priceUsd = pair.priceUsd !== undefined ? parseFloat(pair.priceUsd) || undefined : undefined
    } else if (pair.quoteToken.address.toLowerCase() === lowerAddress) {
      // priceUsd/priceNative are always quoted for the base token; invert to
      // get the quote token's (our token's) USD price.
      const basePriceUsd = pair.priceUsd !== undefined ? parseFloat(pair.priceUsd) : NaN
      const priceNative = pair.priceNative !== undefined ? parseFloat(pair.priceNative) : NaN
      priceUsd = priceNative ? basePriceUsd / priceNative : undefined
    }

    best = { liquidityUsd, priceUsd }
  }

  return best
}

/**
 * Looks up a token by address that isn't in LI.FI's token list (custom /
 * long-tail token). Fetches on-chain metadata via the chain's RPC, then
 * checks DexScreener liquidity to warn (not block) on thin liquidity.
 */
export const lookupCustomToken = async (chainId: number, address: string): Promise<Token | null> => {
  const chainConfig = getChainConfig(chainId)
  if (!chainConfig) return null

  const client = createPublicClient({ transport: http(chainConfig.rpcUrls[0]) })

  let symbol: string
  let name: string
  let decimals: number
  try {
    ;[symbol, name, decimals] = await Promise.all([
      (client.readContract as any)({ address, abi: erc20Abi, functionName: 'symbol' }) as Promise<string>,
      (client.readContract as any)({ address, abi: erc20Abi, functionName: 'name' }) as Promise<string>,
      (client.readContract as any)({ address, abi: erc20Abi, functionName: 'decimals' }) as Promise<number>,
    ])
  } catch {
    // Bad address / not a contract / no ERC-20 metadata at all.
    return null
  }

  const token: Token = { chainId, address, symbol, name, decimals }

  const chainSlug = DEXSCREENER_CHAIN_SLUGS[chainId]
  if (!chainSlug) return token

  try {
    const response = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${address}`)
    if (response.ok) {
      const data = (await response.json()) as DexScreenerTokensResponse
      const match = data.pairs ? bestMatchingPair(data.pairs, chainSlug, address) : null

      if (match) {
        if (match.priceUsd !== undefined) token.priceUsd = match.priceUsd
        if (match.liquidityUsd < LOW_LIQUIDITY_THRESHOLD_USD) token.lowLiquidity = true
      } else {
        // No indexed liquidity at all on this chain — treat as low liquidity,
        // not as a reason to reject the token (it may just be brand new).
        token.lowLiquidity = true
      }
    }
  } catch {
    // DexScreener unreachable — return the on-chain metadata we do have
    // rather than failing the whole lookup over a liquidity-check outage.
  }

  return token
}
