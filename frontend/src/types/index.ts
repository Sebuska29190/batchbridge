export type ChainId = 1 | 8453 | 42161 | 10 | 137

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logo: string
}

export interface TokenWithBalance extends Token {
  balance: string
  balanceFormatted: string
  price: number
  valueUsd: number
  chainId: number
  verified: boolean
  routeAvailable: boolean | null
  blockedReason?: string | null
}

export interface SwapQuote {
  provider: string
  srcToken: string
  dstToken: string
  srcAmount: string
  dstAmount: string
  dstAmountFormatted: string
  route: string[]
  gas: string
  gasUsd: string
  priceImpact: string
  txData?: {
    to: `0x${string}`
    data: `0x${string}`
    value: bigint
  }
}

export interface SwapParams {
  srcToken: Token
  dstToken: Token
  amount: string
  chainId: number
  slippage: number
  userAddress: string
}

export interface SwapTxData {
  to: string
  data: string
  value: string
  gas?: string
  destAmount?: string
}

export interface AggregatedQuote {
  best: SwapQuote
  all: SwapQuote[]
}

export interface ChainConfig {
  id: ChainId
  name: string
  color: string
  logo: string
  explorer: string
  rpcUrls: string[]
  alchemyUrl?: string
}

export type AppRoute = 'swap' | 'bridge' | 'portfolio' | 'analytics'

export interface TxEntry {
  id: string
  timestamp: string
  type: 'swap' | 'bridge'
  status: 'pending' | 'success' | 'failed' | 'cancelled'
  description: string
  sourceChain?: string
  destChain?: string
  txHash?: string
  sourceTokens?: string[]
  outputToken?: string
}
