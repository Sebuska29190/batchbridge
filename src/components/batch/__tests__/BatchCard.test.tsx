import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { BatchCard } from '../BatchCard'
import { useHeldTokens } from '../../../hooks/useBalances'
import { useBatchQuote } from '../../../hooks/useBatchQuote'

const OWNER_ADDRESS = '0x1111111111111111111111111111111111111111'

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: OWNER_ADDRESS, isConnected: true })),
}))

vi.mock('../../../hooks/useBalances', () => ({
  useHeldTokens: vi.fn(),
}))

vi.mock('../../../hooks/useBatchQuote', () => ({
  useBatchQuote: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
}))

const HELD_TOKENS = [
  {
    address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    balance: '10000000', // 10 USDC
    valueUsd: 10,
  },
  {
    address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    symbol: 'DAI',
    name: 'Dai',
    decimals: 18,
    balance: '15000000000000000000', // 15 DAI
    valueUsd: 15,
  },
]

afterEach(cleanup)

describe('BatchCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useHeldTokens).mockReturnValue({ data: HELD_TOKENS, isLoading: false } as any)
    vi.mocked(useBatchQuote).mockReturnValue({ data: undefined, isLoading: false, isError: false } as any)
  })

  it('renders held tokens from useHeldTokens as a selectable list', () => {
    render(<BatchCard />)

    const list = screen.getByRole('list')
    expect(within(list).getByText('USDC')).toBeInTheDocument()
    expect(within(list).getByText('DAI')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Include USDC' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Include DAI' })).toBeInTheDocument()
  })

  it('adds to the running total when a token checkbox is toggled on', () => {
    render(<BatchCard />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Include USDC' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include DAI' }))

    expect(screen.getByText((_, node) => node?.textContent === 'Bridging ≈ $25.00 across 2 tokens')).toBeInTheDocument()
  })

  it('updates the running total correctly when a previously-selected token is deselected', () => {
    render(<BatchCard />)

    const usdcCheckbox = screen.getByRole('checkbox', { name: 'Include USDC' })
    const daiCheckbox = screen.getByRole('checkbox', { name: 'Include DAI' })

    fireEvent.click(usdcCheckbox)
    fireEvent.click(daiCheckbox)
    expect(screen.getByText((_, node) => node?.textContent === 'Bridging ≈ $25.00 across 2 tokens')).toBeInTheDocument()

    fireEvent.click(daiCheckbox)

    expect(screen.getByText((_, node) => node?.textContent === 'Bridging ≈ $10.00 across 1 token')).toBeInTheDocument()
  })

  it('only includes selected tokens in the batch quote request origins', () => {
    render(<BatchCard />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Include USDC' }))
    fireEvent.click(screen.getByRole('button', { name: 'USDC' }))

    expect(useBatchQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        user: OWNER_ADDRESS,
        origins: [
          expect.objectContaining({
            currency: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            amount: '10000000',
          }),
        ],
      }),
    )

    const lastCallRequest = vi.mocked(useBatchQuote).mock.calls.at(-1)?.[0]
    expect(lastCallRequest?.origins).toHaveLength(1)
    expect(lastCallRequest?.origins.some((o: any) => o.currency === '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBe(
      false,
    )
  })

  it('disables the execute control when zero tokens are selected', () => {
    render(<BatchCard />)

    expect(screen.getByRole('button', { name: 'Execute batch' })).toBeDisabled()
  })
})
