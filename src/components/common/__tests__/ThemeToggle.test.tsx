import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeToggle } from '../ThemeToggle'

afterEach(cleanup)

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  // jsdom doesn't implement matchMedia at all - assign a fresh mock directly
  // rather than vi.spyOn, which requires an existing function to wrap.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia // starts dark
})

describe('ThemeToggle', () => {
  it('labels itself by the theme a click would switch to, and flips data-theme on click', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: 'Switch to light theme' })
    fireEvent.click(button)

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })
})
