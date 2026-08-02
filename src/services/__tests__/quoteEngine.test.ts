import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getQuotes, NoRouteError } from '../quoteEngine'
import type { Aggregator, Quote, QuoteRequest } from '../aggregators/types'

const baseRequest: QuoteRequest = {
  fromChainId: 8453,
  toChainId: 137,
  fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  toToken: '0x0000000000000000000000000000000000000000',
  amount: '10000000',
  fromAddress: '0x000000000000000000000000000000000000dEaD',
  slippageBps: 50,
}

const makeQuote = (aggregator: string, netOutputUsd: number, toAmount = '1'): Quote => ({
  aggregator,
  toAmount,
  toAmountMin: toAmount,
  estimatedGasUsd: 0,
  feeUsd: 0,
  netOutputUsd,
  durationSeconds: 1,
  steps: [],
  raw: null,
})

const mockAggregator = (
  id: string,
  opts: {
    supportsCrossChain?: boolean
    supportsChain?: (chainId: number) => boolean
    getQuote: () => Promise<Quote>
  },
): Aggregator => ({
  id,
  supportsCrossChain: opts.supportsCrossChain ?? true,
  supportsChain: opts.supportsChain ?? (() => true),
  getQuote: opts.getQuote,
})

describe('getQuotes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('queries all matching aggregators and returns their quotes', async () => {
    const a = mockAggregator('a', { getQuote: async () => makeQuote('a', 10) })
    const b = mockAggregator('b', { getQuote: async () => makeQuote('b', 5) })

    const result = await getQuotes(baseRequest, [a, b])

    expect(result.quotes).toHaveLength(2)
    expect(result.quotes.map(q => q.aggregator).sort()).toEqual(['a', 'b'])
    expect(result.failures).toHaveLength(0)
  })

  it('skips a failing aggregator instead of failing the whole call', async () => {
    const good = mockAggregator('good', { getQuote: async () => makeQuote('good', 10) })
    const bad = mockAggregator('bad', { getQuote: async () => { throw new Error('boom') } })

    const result = await getQuotes(baseRequest, [good, bad])

    expect(result.quotes).toHaveLength(1)
    expect(result.quotes[0].aggregator).toBe('good')
    expect(result.failures).toEqual([{ aggregator: 'bad', error: 'boom' }])
  })

  it('ranks by netOutputUsd, not raw toAmount', async () => {
    // "big" has a bigger toAmount but a worse net output once fees/gas are
    // accounted for; "small" should still win the ranking.
    const big = mockAggregator('big', { getQuote: async () => makeQuote('big', 5, '999999') })
    const small = mockAggregator('small', { getQuote: async () => makeQuote('small', 50, '1') })

    const result = await getQuotes(baseRequest, [big, small])

    expect(result.quotes.map(q => q.aggregator)).toEqual(['small', 'big'])
  })

  it('throws an aggregated error listing every reason when all aggregators fail', async () => {
    const a = mockAggregator('a', { getQuote: async () => { throw new Error('no route') } })
    const b = mockAggregator('b', { getQuote: async () => { throw new Error('rate limited') } })

    await expect(getQuotes(baseRequest, [a, b])).rejects.toThrow(/a: no route/)
    await expect(getQuotes(baseRequest, [a, b])).rejects.toThrow(/b: rate limited/)
  })

  it('tags the error as no-liquidity when eligible aggregators tried and failed', async () => {
    const a = mockAggregator('a', { getQuote: async () => { throw new Error('boom') } })

    await expect(getQuotes(baseRequest, [a])).rejects.toMatchObject({
      name: 'NoRouteError',
      reason: 'no-liquidity',
    })
  })

  it('tags the error as unsupported-pair when no aggregator even claims to support the chains', async () => {
    const unsupported = mockAggregator('unsupported', {
      supportsChain: () => false,
      getQuote: async () => makeQuote('unsupported', 1),
    })

    const error = await getQuotes(baseRequest, [unsupported]).catch((e) => e)

    expect(error).toBeInstanceOf(NoRouteError)
    expect(error.reason).toBe('unsupported-pair')
  })

  it('only queries aggregators that support the requested chains', async () => {
    const supported = mockAggregator('supported', { getQuote: async () => makeQuote('supported', 1) })
    const unsupported = mockAggregator('unsupported', {
      supportsChain: (chainId) => chainId !== 137,
      getQuote: async () => makeQuote('unsupported', 100),
    })

    const result = await getQuotes(baseRequest, [supported, unsupported])

    expect(result.quotes.map(q => q.aggregator)).toEqual(['supported'])
  })

  it('excludes same-chain-only aggregators from a cross-chain request', async () => {
    const crossChainOk = mockAggregator('cross', { getQuote: async () => makeQuote('cross', 1) })
    const sameChainOnly = mockAggregator('same', {
      supportsCrossChain: false,
      getQuote: async () => makeQuote('same', 100),
    })

    const result = await getQuotes(baseRequest, [crossChainOk, sameChainOnly])

    expect(result.quotes.map(q => q.aggregator)).toEqual(['cross'])
  })

  it('does not let a slow aggregator block a fast one, and times it out at 8s', async () => {
    const fast = mockAggregator('fast', { getQuote: async () => makeQuote('fast', 1) })
    const slow = mockAggregator('slow', {
      getQuote: () => new Promise<Quote>((resolve) => {
        setTimeout(() => resolve(makeQuote('slow', 100)), 20000)
      }),
    })

    const resultPromise = getQuotes(baseRequest, [fast, slow])
    await vi.advanceTimersByTimeAsync(8000)
    const result = await resultPromise

    expect(result.quotes.map(q => q.aggregator)).toEqual(['fast'])
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].aggregator).toBe('slow')
    expect(result.failures[0].error).toMatch(/timed out/i)
  })
})
