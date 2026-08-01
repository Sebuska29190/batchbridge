import { describe, it, expect, vi, afterEach, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { TokenSelectModal } from '../TokenSelectModal'
import type { Token } from '../../../services/tokenRegistry'

const useTokenListMock = vi.fn()
const useCustomTokenLookupMock = vi.fn()
const useHeldTokensMock = vi.fn()

vi.mock('../../../hooks/useTokenList', () => ({
  useTokenList: (...args: unknown[]) => useTokenListMock(...args),
  useCustomTokenLookup: (...args: unknown[]) => useCustomTokenLookupMock(...args),
}))

vi.mock('../../../hooks/useBalances', () => ({
  useHeldTokens: (...args: unknown[]) => useHeldTokensMock(...args),
}))

afterEach(cleanup)

// jsdom reports 0 for offsetWidth/offsetHeight on every element, which makes
// @tanstack/react-virtual think the scroll viewport has zero size and only
// render ~1-2 rows regardless of scroll position. Give every element a real
// size so the virtualizer renders these small test lists the way it would a
// real browser viewport, and restore the descriptors afterwards so this
// doesn't leak into other test files.
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 600 })
})

afterAll(() => {
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
  if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
})

const makeToken = (overrides: Partial<Token>): Token => ({
  chainId: 1,
  address: '0x0000000000000000000000000000000000000001',
  symbol: 'TOK',
  name: 'Token',
  decimals: 18,
  ...overrides,
})

const usdc = makeToken({ address: '0x1111111111111111111111111111111111111111', symbol: 'USDC', name: 'USD Coin' })
const weth = makeToken({ address: '0x2222222222222222222222222222222222222222', symbol: 'WETH', name: 'Wrapped Ether' })
const dai = makeToken({ address: '0x3333333333333333333333333333333333333333', symbol: 'DAI', name: 'Dai Stablecoin' })
const tokens: Token[] = [usdc, weth, dai]

beforeEach(() => {
  useTokenListMock.mockReset().mockReturnValue({ data: tokens, isLoading: false })
  useHeldTokensMock.mockReset().mockReturnValue({ data: [], isLoading: false })
  useCustomTokenLookupMock.mockReset().mockReturnValue({ data: undefined, isLoading: false })
})

describe('TokenSelectModal', () => {
  it('renders the token list from useTokenList', () => {
    render(<TokenSelectModal isOpen onClose={vi.fn()} chainId={1} mode="swap" onSelect={vi.fn()} />)

    expect(useTokenListMock).toHaveBeenCalledWith(1, 'swap')
    expect(screen.getByText('USDC')).toBeInTheDocument()
    expect(screen.getByText('WETH')).toBeInTheDocument()
    expect(screen.getByText('DAI')).toBeInTheDocument()
  })

  it('filters the list by symbol or name, case-insensitively', () => {
    render(<TokenSelectModal isOpen onClose={vi.fn()} chainId={1} mode="swap" onSelect={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search tokens' }), { target: { value: 'dai' } })

    expect(screen.getByText('DAI')).toBeInTheDocument()
    expect(screen.queryByText('USDC')).not.toBeInTheDocument()
    expect(screen.queryByText('WETH')).not.toBeInTheDocument()
  })

  it('triggers the custom-lookup path for a full hex address instead of filtering the list', () => {
    const address = '0x1234567890123456789012345678901234567890'
    render(<TokenSelectModal isOpen onClose={vi.fn()} chainId={1} mode="swap" onSelect={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search tokens' }), { target: { value: address } })

    expect(useCustomTokenLookupMock).toHaveBeenCalledWith(1, address)
    expect(screen.queryByText('USDC')).not.toBeInTheDocument()
    expect(screen.queryByText('WETH')).not.toBeInTheDocument()
    expect(screen.queryByText('DAI')).not.toBeInTheDocument()
  })

  it('shows a low-liquidity warning for a custom-lookup result but still allows selecting it', () => {
    const address = '0x1234567890123456789012345678901234567890'
    const customToken = makeToken({ address, symbol: 'SHIB2', name: 'ShibaClone', lowLiquidity: true })
    useCustomTokenLookupMock.mockReturnValue({ data: customToken, isLoading: false })

    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<TokenSelectModal isOpen onClose={onClose} chainId={1} mode="swap" onSelect={onSelect} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search tokens' }), { target: { value: address } })

    expect(screen.getByText('Low liquidity')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /SHIB2/ }))
    expect(onSelect).toHaveBeenCalledWith(customToken)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders held tokens before non-held tokens', () => {
    useHeldTokensMock.mockReturnValue({
      data: [
        {
          address: dai.address,
          symbol: dai.symbol,
          name: dai.name,
          decimals: dai.decimals,
          balance: '10.0',
          valueUsd: 20,
        },
      ],
      isLoading: false,
    })

    render(
      <TokenSelectModal isOpen onClose={vi.fn()} chainId={1} mode="swap" ownerAddress="0xabc" onSelect={vi.fn()} />
    )

    const rowButtons = screen.getAllByRole('button').filter((button) => within(button).queryByText(/^(USDC|WETH|DAI)$/))
    const symbolsInOrder = rowButtons.map((button) => within(button).getByText(/^(USDC|WETH|DAI)$/).textContent)

    expect(symbolsInOrder[0]).toBe('DAI')
    expect(symbolsInOrder).toEqual(expect.arrayContaining(['USDC', 'WETH', 'DAI']))
  })

  it('clicking a row calls onSelect with that token and then onClose', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<TokenSelectModal isOpen onClose={onClose} chainId={1} mode="swap" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /WETH/ }))

    expect(onSelect).toHaveBeenCalledWith(weth)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows skeleton rows while the token list is loading', () => {
    useTokenListMock.mockReturnValue({ data: undefined, isLoading: true })
    render(<TokenSelectModal isOpen onClose={vi.fn()} chainId={1} mode="swap" onSelect={vi.fn()} />)

    expect(screen.queryByText('USDC')).not.toBeInTheDocument()
  })
})
