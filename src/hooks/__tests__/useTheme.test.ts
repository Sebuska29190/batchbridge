import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../useTheme'

const STORAGE_KEY = 'batchbridge-theme'

// jsdom doesn't implement matchMedia at all, so there's no existing function
// for vi.spyOn to wrap - assign a fresh mock directly instead.
const mockMatchMedia = (matchesLight: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: matchesLight }) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('useTheme', () => {
  it('falls back to the OS preference when nothing is stored', () => {
    mockMatchMedia(true) // light

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('prefers a stored explicit choice over the OS preference', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    mockMatchMedia(true) // OS says light

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('toggleTheme flips the theme, updates the DOM attribute, and persists it', () => {
    mockMatchMedia(false) // dark

    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
  })
})
