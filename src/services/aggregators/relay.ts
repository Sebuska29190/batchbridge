import { RELAY_ERROR_CODES, getRelayErrorMessage } from '../errors'
import { CHAINS } from '../../config/chains'
import type { Aggregator, Quote, QuoteRequest, QuoteStep } from './types'

const RELAY_PROXY_BASE = '/api/relay'

const toNumber = (value: unknown): number => {
  const num = parseFloat(String(value ?? '0'))
  return Number.isFinite(num) ? num : 0
}

export const relayAggregator: Aggregator = {
  id: 'relay',
  supportsCrossChain: true,

  // Relay itself supports more chains than this, but the rest of the app only
  // knows how to display our configured 16 chains for now (src/config/chains.ts).
  supportsChain: (chainId: number) => CHAINS.some(c => c.id === chainId),

  async getQuote(req: QuoteRequest): Promise<Quote> {
    // Same /quote/v2 body shape as getBridgeQuote in bridgeService.ts (line ~631),
    // just posted through our proxy instead of directly to api.relay.link.
    const requestBody = {
      user: req.fromAddress,
      originChainId: req.fromChainId,
      destinationChainId: req.toChainId,
      originCurrency: req.fromToken,
      destinationCurrency: req.toToken,
      amount: req.amount,
      recipient: req.fromAddress,
      tradeType: 'EXACT_INPUT',
      referrer: 'relay.link',
      useDepositAddress: false,
      topupGas: false,
      // Relay wants slippageTolerance as a percentage string ("0.5" == 0.5%),
      // while our request carries it in basis points (50 == 0.5%).
      slippageTolerance: String(req.slippageBps / 100),
    }

    const response = await fetch(`${RELAY_PROXY_BASE}/quote/v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      // Mirrors buildRelayError in bridgeService.ts (line ~457): pull message/
      // errorCode/errorData/requestId off the error body, but prefer the
      // mapped user-facing message from getRelayErrorMessage when an errorCode
      // is present, falling back to the raw message otherwise.
      let data: { message?: string; errorCode?: string; errorData?: unknown; requestId?: string } = {}
      try {
        data = await response.json()
      } catch {
        // ignore body parse failure, keep data = {}
      }
      const fallbackMessage = `Relay quote failed: ${response.status}`
      const message = data.errorCode
        ? getRelayErrorMessage(data.errorCode, data.message || fallbackMessage)
        : data.message || fallbackMessage
      const error = new Error(message) as Error & { code?: string; errorData?: unknown; requestId?: string }
      if (data.errorCode) error.code = data.errorCode
      if (data.errorData) error.errorData = data.errorData
      if (data.requestId) error.requestId = data.requestId
      throw error
    }

    const data = await response.json()
    const fees = data.fees ?? {}
    const details = data.details ?? {}
    const currencyOut = details.currencyOut ?? {}

    // fees.gas is paid separately, in the origin chain's native currency out of
    // the wallet's own balance - it's never reflected in currencyOut, so it's
    // the only cost subtracted from netOutputUsd.
    const estimatedGasUsd = toNumber(fees.gas?.amountUsd)

    // fees.relayerGas + fees.relayerService together equal fees.relayer (Relay's
    // execution/service fee: 0.029736 + 0.035946 == 0.065682 in the captured
    // sample). currencyOut.amountUsd is already net of this - it's the actual
    // amount the user receives after Relay's fee is taken out (confirmed by
    // details.totalImpact/expandedPriceImpact accounting for the same delta
    // between currencyIn.amountUsd and currencyOut.amountUsd). So feeUsd here
    // is informational for display only, like LI.FI's feeCosts, and must NOT
    // be subtracted again in netOutputUsd. fees.relayer itself is skipped to
    // avoid double-counting since it's just the sum of the other two.
    const feeUsd = toNumber(fees.relayerGas?.amountUsd) + toNumber(fees.relayerService?.amountUsd)

    const toAmountUSD = toNumber(currencyOut.amountUsd)
    const netOutputUsd = toAmountUSD - estimatedGasUsd

    const steps: QuoteStep[] = (data.steps ?? []).flatMap((step: { id: string; items?: Array<{ data: Record<string, unknown> }> }) =>
      (step.items ?? []).map((item): QuoteStep => ({
        type: step.id === 'approve' ? 'approve' : 'bridge',
        to: item.data.to as string,
        data: item.data.data as string,
        value: item.data.value as string,
        chainId: item.data.chainId as number,
        gasLimit: item.data.gas as string | undefined,
      }))
    )

    return {
      aggregator: 'relay',
      toAmount: currencyOut.amount,
      toAmountMin: currencyOut.minimumAmount,
      estimatedGasUsd,
      feeUsd,
      netOutputUsd,
      durationSeconds: details.timeEstimate ?? 0,
      steps,
      raw: data,
    }
  },
}
