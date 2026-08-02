import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { useQuote } from '../useQuote'
import { getQuotes } from '../../services/quoteEngine'
import type { Quote, QuoteRequest } from '../../services/aggregators/types'

vi.mock('../../services/quoteEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/quoteEngine')>()
  return {
    ...actual,
    getQuotes: vi.fn(),
  }
})

vi.mock('../../services/aggregators', () => ({
  ALL_AGGREGATORS: [],
}))

const baseRequest: QuoteRequest = {
  fromChainId: 8453,
  toChainId: 137,
  fromToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  toToken: '0x0000000000000000000000000000000000000000',
  amount: '10000000',
  fromAddress: '0x000000000000000000000000000000000000dEaD',
  slippageBps: 50,
}

const makeQuote = (aggregator: string, netOutputUsd: number): Quote => ({
  aggregator,
  toAmount: '1',
  toAmountMin: '1',
  estimatedGasUsd: 0,
  feeUsd: 0,
  netOutputUsd,
  durationSeconds: 1,
  steps: [],
  raw: null,
})

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useQuote', () => {
  it('debounces rapid request changes into a single getQuotes call after 400ms', async () => {
    vi.mocked(getQuotes).mockResolvedValue({ quotes: [makeQuote('a', 10)], failures: [] })

    // Start from a null request (no query fires yet - the initial debounced
    // value equals the initial prop with no delay, so we need a "quiet"
    // starting point before the rapid-fire changes we're actually testing).
    const { rerender } = renderHook(({ request }) => useQuote(request), {
      wrapper: createWrapper(),
      initialProps: { request: null as QuoteRequest | null },
    })

    rerender({ request: { ...baseRequest, amount: '1' } })
    rerender({ request: { ...baseRequest, amount: '2' } })
    rerender({ request: { ...baseRequest, amount: '3' } })

    expect(getQuotes).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(400)

    expect(getQuotes).toHaveBeenCalledTimes(1)
    expect(getQuotes).toHaveBeenCalledWith(expect.objectContaining({ amount: '3' }), [])
  })

  it('never calls getQuotes when request is null', async () => {
    const { result } = renderHook(() => useQuote(null), { wrapper: createWrapper() })

    await vi.advanceTimersByTimeAsync(400)

    expect(getQuotes).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('bestQuote is quotes[0] when there are results, null when empty', async () => {
    vi.mocked(getQuotes).mockResolvedValue({
      quotes: [makeQuote('best', 100), makeQuote('worst', 1)],
      failures: [],
    })

    const { result } = renderHook(() => useQuote(baseRequest), { wrapper: createWrapper() })

    // fake timers still need a microtask flush for the queryFn's resolved
    // promise to propagate into React state - advanceTimersByTimeAsync
    // drains the microtask queue as it advances, so no real-timer-based
    // `waitFor` polling is needed (and would hang under fake timers anyway).
    await vi.advanceTimersByTimeAsync(400)
    expect(result.current.quotes.length).toBe(2)
    expect(result.current.bestQuote).toEqual(makeQuote('best', 100))

    vi.mocked(getQuotes).mockResolvedValue({ quotes: [], failures: [{ aggregator: 'a', error: 'no route' }] })

    const { result: emptyResult } = renderHook(
      () => useQuote({ ...baseRequest, amount: '999' }),
      { wrapper: createWrapper() },
    )

    await vi.advanceTimersByTimeAsync(400)
    expect(emptyResult.current.isFetched).toBe(true)
    expect(emptyResult.current.bestQuote).toBeNull()
  })

  it('changing a single field of the request produces a fresh getQuotes call with the updated value once debounced', async () => {
    vi.mocked(getQuotes).mockResolvedValue({ quotes: [makeQuote('a', 10)], failures: [] })

    const { rerender } = renderHook(({ request }) => useQuote(request), {
      wrapper: createWrapper(),
      initialProps: { request: baseRequest as QuoteRequest | null },
    })

    await vi.advanceTimersByTimeAsync(400)
    expect(getQuotes).toHaveBeenCalledTimes(1)
    expect(getQuotes).toHaveBeenCalledWith(expect.objectContaining({ amount: '10000000' }), [])

    rerender({ request: { ...baseRequest, amount: '20000000' } })
    await vi.advanceTimersByTimeAsync(400)

    expect(getQuotes).toHaveBeenCalledTimes(2)
    expect(getQuotes).toHaveBeenLastCalledWith(expect.objectContaining({ amount: '20000000' }), [])
  })
})
