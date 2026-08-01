import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SwapCard } from '../SwapCard'

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: undefined, isConnected: false })),
  useWalletClient: vi.fn(() => ({ data: undefined })),
}))

vi.mock('../../../hooks/useQuote', () => ({
  useQuote: vi.fn(() => ({ quotes: [], failures: [], bestQuote: null, isLoading: false, error: null })),
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
})
