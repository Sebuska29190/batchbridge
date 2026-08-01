import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lifiAggregator } from '../lifi'
import type { QuoteRequest } from '../types'

// Trimmed real LI.FI response (10 USDC on Base -> POL on Polygon), key fields preserved verbatim.
const SAMPLE_RESPONSE = {
  tool: 'near',
  action: {
    fromChainId: 8453,
    toChainId: 137,
    fromToken: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
    toToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'POL' },
  },
  estimate: {
    toAmount: '139188605246500581060',
    toAmountMin: '135012947089105563628',
    toAmountUSD: '9.9704',
    fromAmountUSD: '10.0368',
    executionDuration: 39,
    feeCosts: [
      { name: 'LIFI Fixed Fee', amountUSD: '0.0251', percentage: '0.0025', included: true },
      { name: 'NearIntents Protocol Fee', amountUSD: '0.0010', percentage: '0.0001', included: true },
      { name: '1ClickSwap API Fee', amountUSD: '0.0010', percentage: '0.0001', included: true },
      { name: 'NearIntents App Fee', amountUSD: '0.0100', percentage: '0.001', included: true },
    ],
    gasCosts: [
      { type: 'SEND', amountUSD: '0.0067' },
    ],
  },
  transactionRequest: {
    value: '0x0',
    to: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    data: '0x3110c7b9000000000000000000000000000000000000000000000000000000000000006',
    from: '0x000000000000000000000000000000000000dEaD',
    chainId: 8453,
    gasPrice: '0x57bcf0',
    gasLimit: '0x12762c',
  },
}

const baseRequest: QuoteRequest = {
  fromChainId: 8453,
  toChainId: 137,
  fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  toToken: '0x0000000000000000000000000000000000000000',
  amount: '10000000',
  fromAddress: '0x000000000000000000000000000000000000dEaD',
  slippageBps: 300,
}

describe('lifiAggregator', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => SAMPLE_RESPONSE,
    })))
  })

  it('has the expected identity', () => {
    expect(lifiAggregator.id).toBe('lifi')
    expect(lifiAggregator.supportsCrossChain).toBe(true)
  })

  it('supports any chain id, not just the configured 16', () => {
    expect(lifiAggregator.supportsChain(8453)).toBe(true)
    expect(lifiAggregator.supportsChain(999999)).toBe(true)
  })

  it('calls the /api/lifi/quote proxy with query params converted from bps', async () => {
    await lifiAggregator.getQuote(baseRequest)
    const call = (fetch as any).mock.calls[0]
    const url = new URL(call[0], 'https://example.test')
    expect(url.pathname).toBe('/api/lifi/quote')
    expect(url.searchParams.get('fromChain')).toBe('8453')
    expect(url.searchParams.get('toChain')).toBe('137')
    expect(url.searchParams.get('fromToken')).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
    expect(url.searchParams.get('toToken')).toBe('0x0000000000000000000000000000000000000000')
    expect(url.searchParams.get('fromAmount')).toBe('10000000')
    expect(url.searchParams.get('fromAddress')).toBe('0x000000000000000000000000000000000000dEaD')
    expect(url.searchParams.get('slippage')).toBe('0.03')
  })

  it('maps the response into a Quote with correct amounts and net output', async () => {
    const quote = await lifiAggregator.getQuote(baseRequest)
    expect(quote.aggregator).toBe('lifi')
    expect(quote.toAmount).toBe('139188605246500581060')
    expect(quote.toAmountMin).toBe('135012947089105563628')
    expect(quote.estimatedGasUsd).toBeCloseTo(0.0067, 6)
    expect(quote.feeUsd).toBeCloseTo(0.0251 + 0.0010 + 0.0010 + 0.0100, 6)
    // netOutputUsd = toAmountUSD - estimatedGasUsd only (fees already netted into toAmountUSD)
    expect(quote.netOutputUsd).toBeCloseTo(9.9704 - 0.0067, 6)
    expect(quote.durationSeconds).toBe(39)
  })

  it('maps transactionRequest into a single bridge step (cross-chain), not an approve step', async () => {
    const quote = await lifiAggregator.getQuote(baseRequest)
    expect(quote.steps).toHaveLength(1)
    const step = quote.steps[0]
    expect(step.type).toBe('bridge')
    expect(step.to).toBe('0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE')
    expect(step.data).toBe(SAMPLE_RESPONSE.transactionRequest.data)
    expect(step.value).toBe('0x0')
    expect(step.chainId).toBe(8453)
    expect(step.gasLimit).toBe('0x12762c')
    expect(quote.steps.some(s => s.type === 'approve')).toBe(false)
  })

  it('maps a same-chain swap to a swap step', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ...SAMPLE_RESPONSE,
        action: { ...SAMPLE_RESPONSE.action, toChainId: 8453 },
      }),
    })))
    const quote = await lifiAggregator.getQuote({ ...baseRequest, toChainId: 8453 })
    expect(quote.steps[0].type).toBe('swap')
  })

  it('throws a useful error on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: 'no route found' }),
    })))
    await expect(lifiAggregator.getQuote(baseRequest)).rejects.toThrow(/no route found/)
  })
})
