import { createPublicClient, http, erc20Abi, formatUnits } from 'viem'
import { mainnet, base, arbitrum, optimism, polygon } from 'viem/chains'

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY

const CHAIN_MAP: Record<number, any> = {
  1: mainnet, 8453: base, 42161: arbitrum, 10: optimism, 137: polygon,
}

const PUBLIC_RPC: Record<number, string[]> = {
  1: ['https://rpc.ankr.com/eth', 'https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com'],
  8453: ['https://mainnet.base.org', 'https://base.llamarpc.com', 'https://base-rpc.publicnode.com'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://arbitrum-one-rpc.publicnode.com'],
  10: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com', 'https://optimism-rpc.publicnode.com'],
  137: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com', 'https://polygon-bor-rpc.publicnode.com'],
}

const ALCHEMY_RPC: Record<number, string> = {
  1: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  8453: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
}

export function getPublicClient(chainId: number) {
  const chain = CHAIN_MAP[chainId]
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`)
  const alchemy = ALCHEMY_RPC[chainId]
  const rpcUrls = PUBLIC_RPC[chainId] || []
  const rpcUrl = (ALCHEMY_API_KEY && alchemy) ? alchemy : rpcUrls[0]
  if (!rpcUrl) throw new Error(`No RPC for chain ${chainId}`)
  return createPublicClient({ chain, transport: http(rpcUrl, { batch: true }), batch: { multicall: true } })
}

export async function getPublicClientWithFallback(chainId: number) {
  const chain = CHAIN_MAP[chainId]
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`)
  const rpcUrls = PUBLIC_RPC[chainId] || []
  const alchemy = ALCHEMY_RPC[chainId]
  const urls = ALCHEMY_API_KEY && alchemy ? [alchemy, ...rpcUrls] : rpcUrls
  for (const url of urls) {
    try {
      const client = createPublicClient({ chain, transport: http(url, { batch: true }), batch: { multicall: true } })
      await client.getBlockNumber()
      return client
    } catch { continue }
  }
  throw new Error(`All RPCs failed for chain ${chainId}`)
}

export function getTokenLogoUrl(chainId: number, tokenAddress: string): string {
  if (!tokenAddress) return ''
  return `https://api.sim.dune.com/beta/token/logo/${chainId}/${tokenAddress.toLowerCase()}`
}

export function formatBalance(balance: string, decimals: number): string {
  if (!balance) return '0'
  const normalized = formatUnits(BigInt(balance), decimals)
  const num = Number(normalized)
  if (!Number.isFinite(num) || num === 0) return '0'
  if (num < 0.0001) return '<0.0001'
  if (num < 1) return num.toFixed(4)
  if (num < 1000) return num.toFixed(2)
  if (num < 1000000) return (num / 1000).toFixed(2) + 'K'
  return (num / 1000000).toFixed(2) + 'M'
}

export function formatUsd(value: number): string {
  if (!value || value === 0) return '$0.00'
  if (value < 0.01) return '<$0.01'
  if (value < 1000) return '$' + value.toFixed(2)
  if (value < 1000000) return '$' + (value / 1000).toFixed(2) + 'K'
  return '$' + (value / 1000000).toFixed(2) + 'M'
}

export async function fetchTokenBalance(chainId: number, tokenAddress: string, ownerAddress: string): Promise<string> {
  const client = await getPublicClientWithFallback(chainId)
  const balance = await client.readContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [ownerAddress as `0x${string}`],
  })
  return balance.toString()
}
