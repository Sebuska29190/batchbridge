export interface QuoteRequest {
  fromChainId: number
  toChainId: number
  /** 0x0 for native token */
  fromToken: string
  toToken: string
  /** Smallest unit (wei), as a string to avoid float precision loss. */
  amount: string
  fromAddress: string
  /** Basis points, e.g. 50 == 0.5% */
  slippageBps: number
}

export interface QuoteStep {
  type: 'approve' | 'swap' | 'bridge'
  to: string
  data: string
  value: string
  chainId: number
  gasLimit?: string
}

export interface Quote {
  aggregator: string
  /** Expected output, smallest unit, as a string. */
  toAmount: string
  /** Output after slippage, smallest unit, as a string. */
  toAmountMin: string
  estimatedGasUsd: number
  feeUsd: number
  /** Ranking basis: output value in USD minus fee and gas. */
  netOutputUsd: number
  durationSeconds: number
  steps: QuoteStep[]
  /** Original provider response, kept for debugging only. */
  raw: unknown
}

export interface Aggregator {
  id: string
  supportsCrossChain: boolean
  supportsChain(chainId: number): boolean
  getQuote(req: QuoteRequest): Promise<Quote>
}
