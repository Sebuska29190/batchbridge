import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Navbar } from '../Navbar'
import type { NavbarProps } from '../Navbar'

// vitest.config.ts sets `globals: false`, so @testing-library/react's
// automatic afterEach cleanup (which relies on a global `afterEach`) never
// registers - wire it up explicitly so each test starts with a fresh DOM.
afterEach(cleanup)

function renderNavbar(overrides: Partial<NavbarProps> = {}) {
  const props: NavbarProps = {
    mode: 'swap',
    onModeChange: vi.fn(),
    isConnected: false,
    onConnectClick: vi.fn(),
    ...overrides,
  }
  render(<Navbar {...props} />)
  return props
}

describe('Navbar', () => {
  it('renders all three mode tabs with the correct one marked aria-selected', () => {
    renderNavbar({ mode: 'bridge' })

    expect(screen.getByRole('tab', { name: 'Swap' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Bridge' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Batch' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onModeChange with the clicked mode', () => {
    const props = renderNavbar({ mode: 'swap' })

    fireEvent.click(screen.getByRole('tab', { name: 'Bridge' }))

    expect(props.onModeChange).toHaveBeenCalledWith('bridge')
  })

  it('wraps focus and selection from the last tab back to the first on ArrowRight', () => {
    const props = renderNavbar({ mode: 'batch' })
    const batchTab = screen.getByRole('tab', { name: 'Batch' })
    batchTab.focus()

    fireEvent.keyDown(batchTab, { key: 'ArrowRight' })

    expect(props.onModeChange).toHaveBeenCalledWith('swap')
    expect(screen.getByRole('tab', { name: 'Swap' })).toHaveFocus()
  })

  it('shows "Connect Wallet" when not connected', () => {
    renderNavbar({ isConnected: false })

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
  })

  it('shows the truncated address when connected', () => {
    const address = `0x7a2f${'0'.repeat(32)}4E91`
    renderNavbar({ isConnected: true, address })

    expect(screen.getByText('0x7a2f…4E91')).toBeInTheDocument()
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument()
  })

  it('calls onDisconnectClick when the connected-state button is clicked', () => {
    const address = `0x7a2f${'0'.repeat(32)}4E91`
    const onDisconnectClick = vi.fn()
    renderNavbar({ isConnected: true, address, onDisconnectClick })

    fireEvent.click(screen.getByText('0x7a2f…4E91'))

    expect(onDisconnectClick).toHaveBeenCalledTimes(1)
  })
})
