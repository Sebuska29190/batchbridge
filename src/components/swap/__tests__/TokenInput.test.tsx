import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TokenInput } from '../TokenInput'
import type { Token } from '../../../services/tokenRegistry'

afterEach(cleanup)

const usdc: Token = {
  chainId: 1,
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
}

describe('TokenInput', () => {
  it('calls onAmountChange with the new value when typing a valid number', () => {
    const onAmountChange = vi.fn()
    render(
      <TokenInput label="You pay" amount="10" onAmountChange={onAmountChange} token={usdc} onTokenClick={() => {}} />
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '10.5' } })
    expect(onAmountChange).toHaveBeenCalledWith('10.5')
  })

  it('does not call onAmountChange when typing a letter or a second decimal point', () => {
    const onAmountChange = vi.fn()
    render(
      <TokenInput label="You pay" amount="10" onAmountChange={onAmountChange} token={usdc} onTokenClick={() => {}} />
    )
    const input = screen.getByRole('textbox') as HTMLInputElement

    fireEvent.change(input, { target: { value: '10a' } })
    expect(onAmountChange).not.toHaveBeenCalled()
    expect(input.value).toBe('10')

    fireEvent.change(input, { target: { value: '1.2.3' } })
    expect(onAmountChange).not.toHaveBeenCalled()
    expect(input.value).toBe('10')
  })

  it('allows an empty string and a trailing decimal point mid-edit', () => {
    const onAmountChange = vi.fn()
    render(
      <TokenInput label="You pay" amount="10" onAmountChange={onAmountChange} token={usdc} onTokenClick={() => {}} />
    )
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '' } })
    expect(onAmountChange).toHaveBeenCalledWith('')

    fireEvent.change(input, { target: { value: '10.' } })
    expect(onAmountChange).toHaveBeenCalledWith('10.')
  })

  it('clicking MAX calls onAmountChange with the balance', () => {
    const onAmountChange = vi.fn()
    render(
      <TokenInput
        label="You pay"
        amount="0"
        onAmountChange={onAmountChange}
        token={usdc}
        onTokenClick={() => {}}
        balance="248.10"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'MAX' }))
    expect(onAmountChange).toHaveBeenCalledWith('248.10')
  })

  it('does not render the MAX button when balance is undefined', () => {
    render(<TokenInput label="You pay" amount="0" onAmountChange={vi.fn()} token={usdc} onTokenClick={() => {}} />)
    expect(screen.queryByRole('button', { name: 'MAX' })).not.toBeInTheDocument()
  })

  it('calls onTokenClick when the token button is clicked, regardless of readOnly', () => {
    const onTokenClick = vi.fn()
    render(<TokenInput label="You receive" amount="5" token={usdc} onTokenClick={onTokenClick} readOnly />)
    fireEvent.click(screen.getByRole('button', { name: /USDC/ }))
    expect(onTokenClick).toHaveBeenCalledTimes(1)
  })

  it('renders the amount as static text, not an editable input, when readOnly', () => {
    render(<TokenInput label="You receive" amount="5" token={usdc} onTokenClick={() => {}} readOnly />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders the amount as static text when onAmountChange is omitted', () => {
    render(<TokenInput label="You receive" amount="5" token={usdc} onTokenClick={() => {}} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows a loading placeholder instead of the amount when isLoadingAmount', () => {
    render(
      <TokenInput label="You receive" amount="5" token={usdc} onTokenClick={() => {}} readOnly isLoadingAmount />
    )
    expect(screen.queryByText('5')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('formats usdValue with 2 decimals and omits the row when undefined', () => {
    const { rerender } = render(
      <TokenInput label="You pay" amount="10" token={usdc} onTokenClick={() => {}} usdValue={12.345} />
    )
    expect(screen.getByText('≈ $12.35')).toBeInTheDocument()

    rerender(<TokenInput label="You pay" amount="10" token={usdc} onTokenClick={() => {}} />)
    expect(screen.queryByText(/≈ \$/)).not.toBeInTheDocument()
  })

  it('shows "Select token" when no token is set', () => {
    render(<TokenInput label="You pay" amount="0" token={null} onTokenClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Select token' })).toBeInTheDocument()
  })
})
