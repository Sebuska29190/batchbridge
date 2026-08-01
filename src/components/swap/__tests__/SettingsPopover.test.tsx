import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SettingsPopover } from '../SettingsPopover'
import type { SettingsPopoverProps } from '../SettingsPopover'

afterEach(cleanup)

function renderPopover(overrides: Partial<SettingsPopoverProps> = {}) {
  const props: SettingsPopoverProps = {
    slippageBps: null,
    onSlippageChange: vi.fn(),
    isOpen: true,
    onClose: vi.fn(),
    ...overrides,
  }
  render(
    <div>
      <button>Outside trigger</button>
      <SettingsPopover {...props} />
    </div>
  )
  return props
}

describe('SettingsPopover', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingsPopover
        slippageBps={null}
        onSlippageChange={vi.fn()}
        isOpen={false}
        onClose={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('calls onSlippageChange(100) when the 1% preset is clicked', () => {
    const props = renderPopover()

    fireEvent.click(screen.getByText('1%'))

    expect(props.onSlippageChange).toHaveBeenCalledWith(100)
  })

  it('marks the preset matching the current slippageBps as selected, and none when custom', () => {
    const { rerender } = render(
      <SettingsPopover
        slippageBps={100}
        onSlippageChange={vi.fn()}
        isOpen
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('1%')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Auto')).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <SettingsPopover
        slippageBps={75}
        onSlippageChange={vi.fn()}
        isOpen
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Auto')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('0.5%')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('1%')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('3%')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSlippageChange(75) when "0.75" is typed into the custom field', () => {
    const props = renderPopover()

    const input = screen.getByLabelText('Custom slippage percentage')
    fireEvent.change(input, { target: { value: '0.75' } })

    expect(props.onSlippageChange).toHaveBeenCalledWith(75)
  })

  it('calls onClose when Escape is pressed', () => {
    const props = renderPopover()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking outside the popover', () => {
    const props = renderPopover()

    fireEvent.mouseDown(screen.getByText('Outside trigger'))

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
