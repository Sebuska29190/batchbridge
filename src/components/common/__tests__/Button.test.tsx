import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Button } from '../Button'

afterEach(cleanup)

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Swap</Button>)
    expect(screen.getByRole('button', { name: 'Swap' })).toBeInTheDocument()
  })

  it('applies the accent background class for variant="primary" but not for "ghost"', () => {
    const { rerender } = render(<Button variant="primary">Confirm</Button>)
    expect(screen.getByRole('button').className).toContain('bg-[var(--accent)]')

    rerender(<Button variant="ghost">Cancel</Button>)
    expect(screen.getByRole('button').className).not.toContain('bg-[var(--accent)]')
  })

  it('disables the button and shows a loading indicator when isLoading', () => {
    render(<Button isLoading>Swap</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('fires onClick normally when not loading or disabled', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Swap</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when a real disabled attribute is set', () => {
    const handleClick = vi.fn()
    render(
      <Button onClick={handleClick} disabled>
        Swap
      </Button>
    )
    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })
})
