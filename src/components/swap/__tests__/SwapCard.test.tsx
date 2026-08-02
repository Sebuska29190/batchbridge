import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SwapCard } from '../SwapCard'
import { useAccount, useSwitchChain } from 'wagmi'
import { CHAINS } from '../../../config/chains'

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: undefined, isConnected: false, chainId: undefined })),
  useWalletClient: vi.fn(() => ({ data: undefined })),
  useSwitchChain: vi.fn(() => ({ switchChain: vi.fn(), isPending: false })),
}))

vi.mock('../../../hooks/useQuote', () => ({
  useQuote: vi.fn(() => ({
    quotes: [],
    failures: [],
    bestQuote: null,
    noRouteReason: null,
    isLoading: false,
    error: null,
  })),
}))

vi.mock('../../../hooks/useBalances', () => ({
  useTokenBalances: vi.fn(() => ({ data: {} })),
  useHeldTokens: vi.fn(() => ({ data: [], isLoading: false })),
}))

vi.mock('../../../hooks/useTokenList', () => ({
  useTokenList: vi.fn(() => ({ data: [], isLoading: false })),
  useCustomTokenLookup: vi.fn(() => ({ data: null, isLoading: false })),
}))

vi.mock('../../../hooks/useSwapExecution', () => ({
  useSwapExecution: vi.fn(() => ({ status: 'idle', error: null, execute: vi.fn(), reset: vi.fn() })),
}))

afterEach(cleanup)

describe('SwapCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing and prompts to connect a wallet when disconnected', () => {
    render(<SwapCard />)
    expect(screen.getByText('Connect wallet')).toBeInTheDocument()
  })

  it('shows the from/to token pickers', () => {
    render(<SwapCard />)
    expect(screen.getByText('You pay')).toBeInTheDocument()
    expect(screen.getByText('You receive')).toBeInTheDocument()
    expect(screen.getAllByText('Select token')).toHaveLength(2)
  })

  it('does not render the offers panel before an amount/tokens are set', () => {
    render(<SwapCard />)
    expect(screen.queryByText('Offers')).not.toBeInTheDocument()
  })

  it('prompts to switch chains when the connected wallet is on a different chain than the "from" side, and switches on click', () => {
    const switchChain = vi.fn()
    vi.mocked(useAccount).mockReturnValue({
      address: '0x000000000000000000000000000000000000dEaD',
      isConnected: true,
      chainId: CHAINS[1].id,
    } as any)
    vi.mocked(useSwitchChain).mockReturnValue({ switchChain, isPending: false } as any)

    render(<SwapCard />)

    const button = screen.getByRole('button', { name: `Switch to ${CHAINS[0].name}` })
    expect(button).not.toBeDisabled()
    fireEvent.click(button)

    expect(switchChain).toHaveBeenCalledWith({ chainId: CHAINS[0].id })
  })
})
