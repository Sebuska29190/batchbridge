import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RouteDetails } from '../RouteDetails'
import type { Quote } from '../../../services/aggregators/types'

afterEach(cleanup)

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    aggregator: 'LiFi',
    toAmount: '1000000000000000000',
    toAmountMin: '990000000000000000', // 0.99 @ 18 decimals
    estimatedGasUsd: 2.5,
    feeUsd: 0,
    netOutputUsd: 100,
    durationSeconds: 30,
    steps: [],
    raw: null,
    ...overrides,
  }
}

describe('RouteDetails', () => {
  it('renders minimum received formatted with the right decimals and symbol', () => {
    const quote = makeQuote({ toAmountMin: '990000000000000000' })
    render(
      <RouteDetails
        quote={quote}
        fromDecimals={18}
        toDecimals={18}
        fromSymbol="ETH"
        toSymbol="USDC"
      />
    )

    expect(screen.getByText('0.99 USDC')).toBeInTheDocument()
  })

  it('renders the network fee formatted as currency', () => {
    const quote = makeQuote({ estimatedGasUsd: 2.5 })
    render(
      <RouteDetails
        quote={quote}
        fromDecimals={18}
        toDecimals={18}
        fromSymbol="ETH"
        toSymbol="USDC"
      />
    )

    expect(screen.getByText('≈ $2.50')).toBeInTheDocument()
  })

  it('shows the provider fee row as Free when feeUsd is 0, not omitted', () => {
    const quote = makeQuote({ feeUsd: 0 })
    render(
      <RouteDetails
        quote={quote}
        fromDecimals={18}
        toDecimals={18}
        fromSymbol="ETH"
        toSymbol="USDC"
      />
    )

    expect(screen.getByText('Provider fee')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('formats duration under 60s as "< 1 min"', () => {
    const quote = makeQuote({ durationSeconds: 30 })
    render(
      <RouteDetails
        quote={quote}
        fromDecimals={18}
        toDecimals={18}
        fromSymbol="ETH"
        toSymbol="USDC"
      />
    )

    expect(screen.getByText('< 1 min')).toBeInTheDocument()
  })

  it('formats duration over 60s as "~N min"', () => {
    const quote = makeQuote({ durationSeconds: 185 })
    render(
      <RouteDetails
        quote={quote}
        fromDecimals={18}
        toDecimals={18}
        fromSymbol="ETH"
        toSymbol="USDC"
      />
    )

    expect(screen.getByText('~3 min')).toBeInTheDocument()
  })

  it('does not throw and renders without data rows when quote is null', () => {
    const { container } = render(
      <RouteDetails
        quote={null}
        fromDecimals={18}
        toDecimals={18}
        fromSymbol="ETH"
        toSymbol="USDC"
      />
    )

    expect(screen.queryByTestId('route-details')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})
