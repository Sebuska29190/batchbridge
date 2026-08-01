import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useTokenList, useCustomTokenLookup } from '../useTokenList'
import { getSwappableTokens } from '../../services/tokenRegistry'
import { getBridgeableTokens } from '../../config/bridgeableAssets'

vi.mock('../../services/tokenRegistry', () => ({
  getSwappableTokens: vi.fn(),
  lookupCustomToken: vi.fn(),
}))

vi.mock('../../config/bridgeableAssets', () => ({
  getBridgeableTokens: vi.fn(),
}))

import { lookupCustomToken } from '../../services/tokenRegistry'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useTokenList', () => {
  it("calls getSwappableTokens and returns its result once loaded, in 'swap' mode", async () => {
    const swapTokens = [{ chainId: 8453, address: '0x1', symbol: 'FOO', name: 'Foo', decimals: 18 }]
    vi.mocked(getSwappableTokens).mockResolvedValue(swapTokens as any)

    const { result } = renderHook(() => useTokenList(8453, 'swap'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getSwappableTokens).toHaveBeenCalledWith(8453)
    expect(getBridgeableTokens).not.toHaveBeenCalled()
    expect(result.current.data).toEqual(swapTokens)
  })

  it("calls getBridgeableTokens (not getSwappableTokens) and maps its result to the full Token shape, in 'bridge' mode", async () => {
    const bridgeTokens = [{ symbol: 'USDC', address: '0x2', decimals: 6 }]
    vi.mocked(getBridgeableTokens).mockReturnValue(bridgeTokens as any)

    const { result } = renderHook(() => useTokenList(8453, 'bridge'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getBridgeableTokens).toHaveBeenCalledWith(8453)
    expect(getSwappableTokens).not.toHaveBeenCalled()
    // getBridgeableTokens only returns {symbol, address, decimals} - the hook
    // maps it to the same Token shape getSwappableTokens produces (chainId
    // filled in, name falls back to symbol, no logoURI) so callers get a
    // uniform Token[] regardless of mode.
    expect(result.current.data).toEqual([
      { chainId: 8453, address: '0x2', symbol: 'USDC', name: 'USDC', decimals: 6 },
    ])
  })

  it('never fires the query when chainId is undefined', async () => {
    const { result } = renderHook(() => useTokenList(undefined, 'swap'), { wrapper: createWrapper() })

    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
    expect(getSwappableTokens).not.toHaveBeenCalled()
    expect(getBridgeableTokens).not.toHaveBeenCalled()
  })
})

describe('useCustomTokenLookup', () => {
  it('does not fire for an obviously-incomplete address', async () => {
    const { result } = renderHook(() => useCustomTokenLookup(8453, '0x123'), { wrapper: createWrapper() })

    expect(result.current.fetchStatus).toBe('idle')
    expect(lookupCustomToken).not.toHaveBeenCalled()
  })

  it('fires for a full 42-char address', async () => {
    const address = '0x9B5E262cF9bb04869ab40b19AF91D2dc85761722'
    vi.mocked(lookupCustomToken).mockResolvedValue({
      chainId: 8453,
      address,
      symbol: 'NOCK',
      name: 'Nock',
      decimals: 18,
    } as any)

    const { result } = renderHook(() => useCustomTokenLookup(8453, address), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(lookupCustomToken).toHaveBeenCalledWith(8453, address)
  })
})
