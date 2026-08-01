import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { useAccount, useWalletClient } from 'wagmi'
import { BridgeCard } from '../BridgeCard'
import { useQuote } from '../../../hooks/useQuote'
import { useTokenBalances } from '../../../hooks/useBalances'
import { useSwapExecution } from '../../../hooks/useSwapExecution'
import { getEquivalent } from '../../../config/bridgeableAssets'

// vitest.config.ts sets `globals: false`, so @testing-library/react's
// automatic afterEach cleanup (which relies on a global `afterEach`) never
// registers - wire it up explicitly so each test starts with a fresh DOM.
afterEach(cleanup)

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: undefined, isConnected: false })),
  useWalletClient: vi.fn(() => ({ data: undefined })),
}))

vi.mock('../../../hooks/useQuote', () => ({
  useQuote: vi.fn(() => ({ quotes: [], failures: [], bestQuote: null, isLoading: false, error: null })),
}))

vi.mock('../../../hooks/useBalances', () => ({
  useTokenBalances: vi.fn(() => ({ data: {} })),
}))

vi.mock('../../../hooks/useSwapExecution', () => ({
  useSwapExecution: vi.fn(() => ({ status: 'idle', error: null, execute: vi.fn(), reset: vi.fn() })),
}))

describe('BridgeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAccount).mockReturnValue({ address: undefined, isConnected: false } as any)
    vi.mocked(useWalletClient).mockReturnValue({ data: undefined } as any)
    vi.mocked(useQuote).mockReturnValue({ quotes: [], failures: [], bestQuote: null, isLoading: false, error: null } as any)
    vi.mocked(useTokenBalances).mockReturnValue({ data: {} } as any)
    vi.mocked(useSwapExecution).mockReturnValue({ status: 'idle', error: null, execute: vi.fn(), reset: vi.fn() } as any)
  })

  it('renders source/destination chain selects, and changing destination excludes the source chain', () => {
    render(<BridgeCard />)

    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
    // Default state: fromChainId = Ethereum (1), toChainId = Optimism (10).
    expect(screen.getByRole('button', { name: /Ethereum/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Optimism/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Optimism/i }))
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).queryByText('Ethereum')).not.toBeInTheDocument()
    expect(within(listbox).getByText('Polygon')).toBeInTheDocument()
  })

  it('resets the selected asset when changing destination makes it invalid there', () => {
    render(<BridgeCard />)

    // ETH is available from Ethereum(1) to Optimism(10) (default state).
    fireEvent.click(screen.getByRole('button', { name: 'ETH' }))
    expect(screen.getByRole('button', { name: 'ETH', pressed: true })).toBeInTheDocument()
    // Both amount fields now show the selected token instead of the placeholder.
    expect(screen.queryAllByText('Select token')).toHaveLength(0)

    // Gnosis (chainId 100) has no ETH entry in bridgeableAssets.ts's addressesByChain map.
    fireEvent.click(screen.getByRole('button', { name: /Optimism/i }))
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Gnosis'))

    // Selection should have been reset rather than silently kept.
    expect(screen.queryByRole('button', { name: 'ETH', pressed: true })).not.toBeInTheDocument()
    expect(screen.getAllByText('Select token')).toHaveLength(2)
  })

  it('builds a QuoteRequest with toToken from getEquivalent once an asset and amount are set', () => {
    vi.mocked(useAccount).mockReturnValue({ address: '0xOwner', isConnected: true } as any)

    render(<BridgeCard />)

    fireEvent.click(screen.getByRole('button', { name: 'USDC' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10' } })

    const expectedToToken = getEquivalent('USDC', 1, 10)
    expect(expectedToToken).not.toBeNull()

    const calls = vi.mocked(useQuote).mock.calls
    const lastRequest = calls[calls.length - 1][0]
    expect(lastRequest).toMatchObject({
      fromChainId: 1,
      toChainId: 10,
      fromAddress: '0xOwner',
      toToken: expectedToToken,
    })
  })

  it("does not fire a quote request before an asset/amount is set", () => {
    render(<BridgeCard />)
    const calls = vi.mocked(useQuote).mock.calls
    expect(calls[calls.length - 1][0]).toBeNull()
  })

  it("reflects useSwapExecution's status in the bridge button label", () => {
    render(<BridgeCard />)
    expect(screen.getByText('Connect wallet')).toBeInTheDocument()

    cleanup()
    vi.mocked(useAccount).mockReturnValue({ address: '0xOwner', isConnected: true } as any)
    vi.mocked(useSwapExecution).mockReturnValue({ status: 'approving', error: null, execute: vi.fn(), reset: vi.fn() } as any)

    render(<BridgeCard />)
    fireEvent.click(screen.getByRole('button', { name: 'ETH' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } })

    expect(screen.getByText('Approving…')).toBeInTheDocument()
  })

  it('does not render TransferProgress before execution starts, renders once status is not idle', () => {
    const { rerender } = render(<BridgeCard />)
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
    // The card's own mode label also reads "Bridge", so before execution
    // starts there should be exactly that one occurrence (no step yet).
    expect(screen.getAllByText('Bridge')).toHaveLength(1)

    vi.mocked(useSwapExecution).mockReturnValue({ status: 'bridging', error: null, execute: vi.fn(), reset: vi.fn() } as any)
    rerender(<BridgeCard />)

    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getAllByText('Bridge')).toHaveLength(2) // mode label + TransferProgress step
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })
})
