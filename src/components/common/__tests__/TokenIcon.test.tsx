import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TokenIcon } from '../TokenIcon'

afterEach(cleanup)

describe('TokenIcon', () => {
  it('renders an img when logoURI is given', () => {
    render(<TokenIcon logoURI="https://example.com/eth.png" symbol="ETH" />)
    const img = screen.getByRole('img', { name: 'ETH' }) as HTMLImageElement
    expect(img.src).toBe('https://example.com/eth.png')
  })

  it('falls back to initials when logoURI is absent', () => {
    render(<TokenIcon symbol="ETH" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('ET')).toBeInTheDocument()
  })

  it('falls back to initials when the img fires onError', () => {
    render(<TokenIcon logoURI="https://example.com/broken.png" symbol="USDC" />)
    const img = screen.getByRole('img', { name: 'USDC' })
    fireEvent.error(img)
    expect(screen.queryByRole('img', { name: 'USDC' })).not.toBeInTheDocument()
    expect(screen.getByText('US')).toBeInTheDocument()
  })

  it('produces the same fallback color for the same symbol across separate renders', () => {
    const { container: containerA } = render(<TokenIcon symbol="ARB" />)
    const colorA = (containerA.firstChild as HTMLElement).style.backgroundColor
    cleanup()

    const { container: containerB } = render(<TokenIcon symbol="ARB" />)
    const colorB = (containerB.firstChild as HTMLElement).style.backgroundColor

    expect(colorA).not.toBe('')
    expect(colorA).toBe(colorB)
  })

  it('renders the chain badge only when chainLogoURI is given', () => {
    const { rerender, container } = render(<TokenIcon symbol="ETH" logoURI="https://example.com/eth.png" />)
    expect(container.querySelectorAll('img')).toHaveLength(1)

    rerender(
      <TokenIcon
        symbol="ETH"
        logoURI="https://example.com/eth.png"
        chainLogoURI="https://example.com/base.png"
      />
    )
    expect(container.querySelectorAll('img')).toHaveLength(2)
  })
})
