import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBatchQuote } from '../useBatchQuote'
import { getMultiInputQuote } from '../../services/batchQuote'

vi.mock('../../services/batchQuote', () => ({
  getMultiInputQuote: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

const request = {
  user: '0x000000000000000000000000000000000000dEaD',
  origins: [
    { chainId: 8453, currency: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: '10000000' },
    { chainId: 42161, currency: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', amount: '5000000' },
  ],
  destinationChainId: 137,
  destinationCurrency: '0x0000000000000000000000000000000000000000',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useBatchQuote', () => {
  it('calls getMultiInputQuote with the request mapped to its expected shape', async () => {
    vi.mocked(getMultiInputQuote).mockResolvedValue({ some: 'quote' } as any)

    const { result } = renderHook(() => useBatchQuote(request), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(getMultiInputQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        user: request.user,
        origins: request.origins,
        destinationChainId: 137,
        destinationCurrency: request.destinationCurrency,
      }),
    )
    expect(result.current.data).toEqual({ some: 'quote' })
  })

  it('converts slippageBps to a percent for slippageTolerance', async () => {
    vi.mocked(getMultiInputQuote).mockResolvedValue({} as any)

    renderHook(() => useBatchQuote({ ...request, slippageBps: 50 }), { wrapper: createWrapper() })

    await waitFor(() => expect(getMultiInputQuote).toHaveBeenCalled())
    expect(getMultiInputQuote).toHaveBeenCalledWith(expect.objectContaining({ slippageTolerance: 0.5 }))
  })

  it('never fires when request is null', () => {
    renderHook(() => useBatchQuote(null), { wrapper: createWrapper() })
    expect(getMultiInputQuote).not.toHaveBeenCalled()
  })

  it('never fires when origins is empty', () => {
    renderHook(() => useBatchQuote({ ...request, origins: [] }), { wrapper: createWrapper() })
    expect(getMultiInputQuote).not.toHaveBeenCalled()
  })
})
