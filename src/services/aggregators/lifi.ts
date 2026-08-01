import type { Aggregator, Quote, QuoteRequest, QuoteStep } from './types'

const LIFI_PROXY_BASE = '/api/lifi'

/** Default execution duration (seconds) when LI.FI's response doesn't include estimate.executionDuration. */
const DEFAULT_DURATION_SECONDS = 60

const sumAmountUSD = (items: Array<{ amountUSD?: string }> | undefined): number => {
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + (parseFloat(item.amountUSD ?? '0') || 0), 0)
}

export const lifiAggregator: Aggregator = {
  id: 'lifi',
  supportsCrossChain: true,

  // LI.FI covers far more chains than our 16-chain config (src/config/chains.ts is
  // just the list our UI displays), so this adapter accepts any chain id.
  supportsChain: () => true,

  async getQuote(req: QuoteRequest): Promise<Quote> {
    const params = new URLSearchParams({
      fromChain: String(req.fromChainId),
      toChain: String(req.toChainId),
      fromToken: req.fromToken,
      toToken: req.toToken,
      fromAmount: req.amount,
      fromAddress: req.fromAddress,
      slippage: String(req.slippageBps / 10000),
    })

    const response = await fetch(`${LIFI_PROXY_BASE}/quote?${params.toString()}`)

    if (!response.ok) {
      let message = `LI.FI quote failed: ${response.status}`
      try {
        const data = await response.json()
        if (data?.message) message = data.message
      } catch {
        // ignore body parse failure, keep fallback message
      }
      throw new Error(message)
    }

    const data = await response.json()
    const estimate = data.estimate ?? {}

    const estimatedGasUsd = sumAmountUSD(estimate.gasCosts)
    const feeUsd = sumAmountUSD(estimate.feeCosts)
    const toAmountUSD = parseFloat(estimate.toAmountUSD ?? '0') || 0

    // Fee costs in LI.FI's response are all `included: true`, meaning they're
    // already netted into toAmount/toAmountUSD. Gas is paid separately from the
    // wallet's native balance and is NOT part of toAmountUSD, so only gas is
    // subtracted here; feeUsd is informational only.
    const netOutputUsd = toAmountUSD - estimatedGasUsd

    const isCrossChain = data.action?.fromChainId !== data.action?.toChainId
    const tx = data.transactionRequest ?? {}

    const steps: QuoteStep[] = [
      {
        type: isCrossChain ? 'bridge' : 'swap',
        to: tx.to,
        data: tx.data,
        value: tx.value,
        chainId: tx.chainId,
        gasLimit: tx.gasLimit,
      },
    ]

    return {
      aggregator: 'lifi',
      toAmount: estimate.toAmount,
      toAmountMin: estimate.toAmountMin,
      estimatedGasUsd,
      feeUsd,
      netOutputUsd,
      durationSeconds: estimate.executionDuration ?? DEFAULT_DURATION_SECONDS,
      steps,
      raw: data,
    }
  },
}
