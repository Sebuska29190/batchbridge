import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useHeldTokens, useTokenBalances } from '../useBalances'
import { fetchBalances, discoverHeldTokens } from '../../services/balances'

vi.mock('../../services/balances', () => ({
  fetchBalances: vi.fn(),
  discoverHeldTokens: vi.fn(),
}))

const OWNER = '0x000000000000000000000000000000000000dEaD'

function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useHeldTokens', () => {
  it('calls discoverHeldTokens with the right args and surfaces its result', async () => {
    const heldTokens = [{ address: '0xabc', symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: '100', valueUsd: 100 }]
    vi.mocked(discoverHeldTokens).mockResolvedValue(heldTokens as any)

    const { result } = renderHook(() => useHeldTokens(8453, OWNER), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(discoverHeldTokens).toHaveBeenCalledWith(8453, OWNER)
    expect(result.current.data).toEqual(heldTokens)
  })

  it('never fires when chainId is undefined', async () => {
    const { result } = renderHook(() => useHeldTokens(undefined, OWNER), { wrapper: createWrapper() })

    expect(result.current.fetchStatus).toBe('idle')
    expect(discoverHeldTokens).not.toHaveBeenCalled()
  })
})

describe('useTokenBalances', () => {
  it('never fires with an empty tokenAddresses array', async () => {
    const { result } = renderHook(() => useTokenBalances(8453, OWNER, []), { wrapper: createWrapper() })

    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchBalances).not.toHaveBeenCalled()
  })

  it('produces a stable, deduped query key regardless of tokenAddresses order (cache hit on reorder)', async () => {
    const tokenA = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const tokenB = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
    vi.mocked(fetchBalances).mockResolvedValue({ [tokenA]: '1', [tokenB]: '2' })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = createWrapper(queryClient)

    const first = renderHook(() => useTokenBalances(8453, OWNER, [tokenA, tokenB]), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    const second = renderHook(() => useTokenBalances(8453, OWNER, [tokenB, tokenA]), { wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(fetchBalances).toHaveBeenCalledTimes(1)
  })
})
