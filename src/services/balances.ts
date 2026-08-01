import { createPublicClient, http, erc20Abi } from 'viem'
import { getChainConfig, type ChainConfig } from '../config/chains'

export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

// Multicall3 handles chunking well on its own, but we keep individual
// JSON-RPC payload sizes sane on free public RPCs by capping each batch.
const MULTICALL_CHUNK_SIZE = 200

const BLOCKSCOUT_PROXY_BASE = '/api/blockscout'

export interface HeldToken {
  address: string
  symbol: string
  name: string
  decimals: number
  balance: string
  valueUsd: number
}

interface BlockscoutTokenBalanceEntry {
  token: {
    address_hash: string
    decimals: string | null
    symbol: string
    name: string
    type: string
    exchange_rate: string | null
  }
  value: string
}

const isNativeToken = (address: string): boolean =>
  address.toLowerCase() === NATIVE_TOKEN_ADDRESS

/**
 * Reads token balances for a wallet on one chain via an on-chain Multicall3
 * batch call. Returns a map of token address -> raw balance (smallest unit,
 * as a string). The native token (0x0) is special-cased since balanceOf
 * doesn't apply to it.
 */
export const fetchBalances = async (
  chainId: number,
  ownerAddress: string,
  tokenAddresses: string[]
): Promise<Record<string, string>> => {
  const chainConfig = getChainConfig(chainId)
  if (!chainConfig) throw new Error(`Unsupported chain: ${chainId}`)

  const client = createPublicClient({
    transport: http(chainConfig.rpcUrls[0]),
  })

  const erc20Addresses = tokenAddresses.filter(address => !isNativeToken(address))
  const hasNative = tokenAddresses.some(isNativeToken)

  const chunks: string[][] = []
  for (let i = 0; i < erc20Addresses.length; i += MULTICALL_CHUNK_SIZE) {
    chunks.push(erc20Addresses.slice(i, i + MULTICALL_CHUNK_SIZE))
  }

  // Cast around a viem@2.55 generic-inference quirk on readContract/multicall
  // (same workaround already used in aggregators/paraswap.ts).
  const [nativeBalance, ...chunkResults] = await Promise.all([
    hasNative ? client.getBalance({ address: ownerAddress as `0x${string}` }) : Promise.resolve(null),
    ...chunks.map(chunk =>
      (client.multicall as any)({
        contracts: chunk.map(address => ({
          address: address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [ownerAddress as `0x${string}`],
        })),
        allowFailure: true,
        multicallAddress: chainConfig.multicall3Address as `0x${string}`,
        // We already chunk manually to MULTICALL_CHUNK_SIZE calls per request;
        // disable viem's own byte-size-based sub-chunking (default 1024 bytes)
        // so each chunk is exactly one eth_call, not several smaller ones.
        batchSize: 0,
      })
    ),
  ])

  const balances: Record<string, string> = {}

  if (hasNative && nativeBalance !== null) {
    balances[NATIVE_TOKEN_ADDRESS] = (nativeBalance as bigint).toString()
  }

  chunks.forEach((chunk, chunkIndex) => {
    const results = chunkResults[chunkIndex] as Array<{ status: string; result?: bigint }>
    chunk.forEach((address, i) => {
      const result = results[i]
      balances[address] = result.status === 'success' && result.result !== undefined
        ? result.result.toString()
        : '0'
    })
  })

  return balances
}

const nativeTokenInfo = (chainConfig: ChainConfig) => ({
  address: NATIVE_TOKEN_ADDRESS,
  symbol: chainConfig.nativeSymbol,
  name: chainConfig.nativeSymbol,
  decimals: 18,
})

/**
 * Fallback for chains with no Blockscout instance (BSC, Mantle, Avalanche,
 * Linea, Blast - see src/config/chains.ts). There's no proper "top N tokens
 * per chain" list built yet, and inventing addresses we're not sure about is
 * worse than under-reporting, so this only checks the native token balance
 * until such a list exists.
 */
const fallbackDiscoverHeldTokens = async (
  chainId: number,
  ownerAddress: string,
  chainConfig: ChainConfig
): Promise<HeldToken[]> => {
  const native = nativeTokenInfo(chainConfig)
  const balances = await fetchBalances(chainId, ownerAddress, [native.address])
  const balance = balances[native.address] ?? '0'
  if (balance === '0') return []
  // No price source wired in for this fallback path.
  return [{ ...native, balance, valueUsd: 0 }]
}

/**
 * Discovers which tokens a wallet actually holds, for populating the "your
 * tokens" list in the swap picker. Primary source is Blockscout (via our
 * proxy); results are then verified against on-chain multicall balances
 * since Blockscout can lag a few blocks - multicall always wins, and a
 * token that multicall says is zero gets dropped rather than shown stale.
 */
export const discoverHeldTokens = async (
  chainId: number,
  ownerAddress: string
): Promise<HeldToken[]> => {
  const chainConfig = getChainConfig(chainId)
  if (!chainConfig) throw new Error(`Unsupported chain: ${chainId}`)

  if (!chainConfig.blockscoutUrl) {
    return fallbackDiscoverHeldTokens(chainId, ownerAddress, chainConfig)
  }

  const path = `/addresses/${ownerAddress}/token-balances`
  const url = `${BLOCKSCOUT_PROXY_BASE}?chainId=${chainId}&path=${encodeURIComponent(path)}`

  let entries: BlockscoutTokenBalanceEntry[]
  try {
    const response = await fetch(url)
    if (!response.ok) return fallbackDiscoverHeldTokens(chainId, ownerAddress, chainConfig)
    const data = await response.json()
    if (!Array.isArray(data)) return fallbackDiscoverHeldTokens(chainId, ownerAddress, chainConfig)
    entries = data
  } catch {
    return fallbackDiscoverHeldTokens(chainId, ownerAddress, chainConfig)
  }

  const candidates = entries
    .filter(entry => entry.token?.type === 'ERC-20' && entry.value !== '0' && entry.token?.decimals != null)
    .map(entry => {
      const decimals = Number(entry.token.decimals)
      const exchangeRate = entry.token.exchange_rate
      const price = exchangeRate !== null && exchangeRate !== undefined ? Number(exchangeRate) : null
      return {
        address: entry.token.address_hash,
        symbol: entry.token.symbol,
        name: entry.token.name,
        decimals,
        balance: entry.value,
        price: price !== null && Number.isFinite(price) ? price : null,
      }
    })

  if (candidates.length === 0) return []

  const onChainBalances = await fetchBalances(chainId, ownerAddress, candidates.map(c => c.address))

  const verified: HeldToken[] = []
  for (const candidate of candidates) {
    const onChainBalance = onChainBalances[candidate.address] ?? '0'
    if (onChainBalance === '0') continue // multicall says zero - don't show a stale nonzero balance

    const humanBalance = Number(onChainBalance) / 10 ** candidate.decimals
    const valueUsd = candidate.price !== null ? humanBalance * candidate.price : 0

    verified.push({
      address: candidate.address,
      symbol: candidate.symbol,
      name: candidate.name,
      decimals: candidate.decimals,
      balance: onChainBalance,
      valueUsd,
    })
  }

  return verified
}
