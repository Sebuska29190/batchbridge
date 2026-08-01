import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ChainIcon } from '../ChainIcon'

afterEach(cleanup)

describe('ChainIcon', () => {
  it('renders an img when logo is given', () => {
    render(<ChainIcon logo="https://example.com/base.png" name="Base" />)
    const img = screen.getByRole('img', { name: 'Base' }) as HTMLImageElement
    expect(img.src).toBe('https://example.com/base.png')
  })

  it('falls back to a colored circle using color when logo is absent', () => {
    const { container } = render(<ChainIcon name="Base" color="#0052ff" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect((container.firstChild as HTMLElement).style.backgroundColor).toBe('rgb(0, 82, 255)')
  })
})
