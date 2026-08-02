import { describe, it, expect, vi, beforeEach } from 'vitest'
import { relayAggregator } from '../relay'
import type { QuoteRequest } from '../types'

// Trimmed real Relay /quote/v2 response (10 USDC on Base -> POL on Polygon), key fields preserved verbatim.
const SAMPLE_RESPONSE = {
  steps: [
    {
      id: 'approve',
      items: [
        {
          data: {
            from: '0x000000000000000000000000000000000000dEaD',
            to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            data: '0x095ea7b3000000000000000000000000',
            value: '0',
            chainId: 8453,
            gas: '73112',
            maxFeePerGas: '6500000',
            maxPriorityFeePerGas: '1000000',
          },
        },
      ],
    },
    {
      id: 'deposit',
      items: [
        {
          data: {
            from: '0x000000000000000000000000000000000000dEaD',
            to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
            data: '0xe8017952000000000000000000000000000000',
            value: '0',
            chainId: 8453,
            gas: '75909',
            maxFeePerGas: '6500000',
            maxPriorityFeePerGas: '1000000',
          },
        },
      ],
    },
  ],
  fees: {
    gas: { amountUsd: '0.000850' },
    relayer: { amountUsd: '0.065682' },
    relayerGas: { amountUsd: '0.029736' },
    relayerService: { amountUsd: '0.035946' },
    app: { amountUsd: '0' },
  },
  details: {
    operation: 'swap',
    currencyIn: { amountUsd: '9.998770' },
    currencyOut: {
      amount: '136915535616366261507',
      minimumAmount: '134177224904038936276',
      amountUsd: '9.915423',
    },
    timeEstimate: 3,
  },
}

const baseRequest: QuoteRequest = {
  fromChainId: 8453,
  toChainId: 137,
  fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  toToken: '0x0000000000000000000000000000000000000000',
  amount: '10000000',
  fromAddress: '0x000000000000000000000000000000000000dEaD',
  slippageBps: 50,
}

describe('relayAggregator', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => SAMPLE_RESPONSE,
    })))
  })

  it('has the expected identity', () => {
    expect(relayAggregator.id).toBe('relay')
    expect(relayAggregator.supportsCrossChain).toBe(true)
  })

  it('supports only the 16 configured chains', () => {
    expect(relayAggregator.supportsChain(8453)).toBe(true)
    expect(relayAggregator.supportsChain(137)).toBe(true)
    expect(relayAggregator.supportsChain(999999)).toBe(false)
  })

  it('POSTs to the /api/relay/quote/v2 proxy with the ported request body shape', async () => {
    await relayAggregator.getQuote(baseRequest)
    const call = (fetch as any).mock.calls[0]
    expect(call[0]).toBe('/api/relay/quote/v2')
    const body = JSON.parse(call[1].body)
    expect(body).toMatchObject({
      user: baseRequest.fromAddress,
      originChainId: 8453,
      destinationChainId: 137,
      originCurrency: baseRequest.fromToken,
      destinationCurrency: baseRequest.toToken,
      amount: '10000000',
      recipient: baseRequest.fromAddress,
      tradeType: 'EXACT_INPUT',
      referrer: 'relay.link',
      useDepositAddress: false,
      topupGas: false,
      slippageTolerance: '50',
    })
  })

  it('maps the response into a Quote with correct amounts and net output', async () => {
    const quote = await relayAggregator.getQuote(baseRequest)
    expect(quote.aggregator).toBe('relay')
    expect(quote.toAmount).toBe('136915535616366261507')
    expect(quote.toAmountMin).toBe('134177224904038936276')
    // Only fees.gas is paid separately (native currency from wallet balance) and
    // is not reflected in currencyOut, so it's the only thing subtracted below.
    expect(quote.estimatedGasUsd).toBeCloseTo(0.000850, 6)
    // relayerGas + relayerService (== fees.relayer, already netted into currencyOut.amountUsd) is informational.
    expect(quote.feeUsd).toBeCloseTo(0.029736 + 0.035946, 6)
    expect(quote.netOutputUsd).toBeCloseTo(9.915423 - 0.000850, 6)
    expect(quote.durationSeconds).toBe(3)
  })

  it('maps approve and deposit steps to approve/bridge QuoteSteps', async () => {
    const quote = await relayAggregator.getQuote(baseRequest)
    expect(quote.steps).toHaveLength(2)
    expect(quote.steps[0].type).toBe('approve')
    expect(quote.steps[0].to).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
    expect(quote.steps[0].gasLimit).toBe('73112')
    expect(quote.steps[1].type).toBe('bridge')
    expect(quote.steps[1].to).toBe('0x4cd00e387622c35bddb9b4c962c136462338bc31')
    expect(quote.steps[1].chainId).toBe(8453)
  })

  it('throws a friendly, error-code-aware error on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ message: 'raw message', errorCode: 'INSUFFICIENT_LIQUIDITY' }),
    })))
    await expect(relayAggregator.getQuote(baseRequest)).rejects.toThrow(/liquidity/i)
  })
})
