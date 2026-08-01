import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Skeleton } from '../Skeleton'

afterEach(cleanup)

describe('Skeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('applies rounded-full for variant="circular"', () => {
    const { container } = render(<Skeleton variant="circular" />)
    expect((container.firstChild as HTMLElement).className).toContain('rounded-full')
  })

  it('applies a text-line shape for variant="text"', () => {
    const { container } = render(<Skeleton variant="text" />)
    expect((container.firstChild as HTMLElement).className).toContain('rounded-md')
  })

  it('applies the radius-sm token for variant="rectangular"', () => {
    const { container } = render(<Skeleton variant="rectangular" />)
    expect((container.firstChild as HTMLElement).className).toContain('rounded-[var(--radius-sm)]')
  })
})
