import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QuoteComparison } from '../QuoteComparison'
import type { Quote } from '../../../services/aggregators/types'

// vitest.config.ts sets `globals: false`, so @testing-library/react's
// automatic afterEach cleanup never registers - wire it up explicitly.
afterEach(cleanup)

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    aggregator: 'LiFi',
    toAmount: '1000000000000000000', // 1.0 @ 18 decimals
    toAmountMin: '990000000000000000',
    estimatedGasUsd: 1.2,
    feeUsd: 0,
    netOutputUsd: 100,
    durationSeconds: 30,
    steps: [],
    raw: null,
    ...overrides,
  }
}

describe('QuoteComparison', () => {
  it('renders the best quote expanded and highlighted with a Best indicator', () => {
    const quotes = [makeQuote({ aggregator: 'LiFi', netOutputUsd: 100 })]
    render(<QuoteComparison quotes={quotes} failures={[]} isLoading={false} decimals={18} />)

    expect(screen.getByTestId('quote-row-LiFi')).toBeInTheDocument()
    expect(screen.getByTestId('quote-best-badge')).toBeInTheDocument()
    expect(screen.getByText('Best')).toBeInTheDocument()
  })

  it('keeps other quotes collapsed until the toggle is clicked', () => {
    const quotes = [
      makeQuote({ aggregator: 'LiFi', netOutputUsd: 100 }),
      makeQuote({ aggregator: 'Rubic', netOutputUsd: 98 }),
      makeQuote({ aggregator: 'Relay', netOutputUsd: 97 }),
    ]
    render(<QuoteComparison quotes={quotes} failures={[]} isLoading={false} decimals={18} />)

    expect(screen.queryByTestId('quote-row-Rubic')).not.toBeInTheDocument()
    expect(screen.queryByTestId('quote-row-Relay')).not.toBeInTheDocument()

    const toggle = screen.getByTestId('quote-toggle')
    expect(toggle).toHaveTextContent('Show 2 more')

    fireEvent.click(toggle)

    expect(screen.getByTestId('quote-row-Rubic')).toBeInTheDocument()
    expect(screen.getByTestId('quote-row-Relay')).toBeInTheDocument()
    expect(toggle).toHaveTextContent('Hide')

    fireEvent.click(toggle)
    expect(screen.queryByTestId('quote-row-Rubic')).not.toBeInTheDocument()
  })

  it('computes and displays the correct percentage delta from the best quote', () => {
    const quotes = [
      makeQuote({ aggregator: 'LiFi', netOutputUsd: 100 }),
      makeQuote({ aggregator: 'Rubic', netOutputUsd: 99 }),
    ]
    render(<QuoteComparison quotes={quotes} failures={[]} isLoading={false} decimals={18} />)

    fireEvent.click(screen.getByTestId('quote-toggle'))

    const rubicRow = screen.getByTestId('quote-row-Rubic')
    expect(rubicRow).toHaveTextContent('-1.00%')
  })

  it('renders failures distinguishably, with aggregator name and error', () => {
    const quotes = [makeQuote({ aggregator: 'LiFi' })]
    const failures = [{ aggregator: 'ParaSwap', error: 'no route available' }]
    render(<QuoteComparison quotes={quotes} failures={failures} isLoading={false} decimals={18} />)

    const failureRow = screen.getByTestId('quote-failure-ParaSwap')
    expect(failureRow).toHaveTextContent('ParaSwap')
    expect(failureRow).toHaveTextContent('no route available')
    // distinguishable from a real quote row: no amount, no testid clash
    expect(screen.queryByTestId('quote-row-ParaSwap')).not.toBeInTheDocument()
  })

  it('shows skeleton placeholders while loading with no quotes yet', () => {
    render(<QuoteComparison quotes={[]} failures={[]} isLoading decimals={18} />)

    expect(screen.getByTestId('quote-comparison-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('Enter an amount to see quotes')).not.toBeInTheDocument()
  })

  it('shows the pre-input empty state when there are no quotes, no failures, and not loading', () => {
    render(<QuoteComparison quotes={[]} failures={[]} isLoading={false} decimals={18} />)

    expect(screen.getByText('Enter an amount to see quotes')).toBeInTheDocument()
  })

  it('calls onSelectQuote with the clicked quote when provided', () => {
    const onSelectQuote = vi.fn()
    const best = makeQuote({ aggregator: 'LiFi', netOutputUsd: 100 })
    const quotes = [best]
    render(
      <QuoteComparison
        quotes={quotes}
        failures={[]}
        isLoading={false}
        decimals={18}
        onSelectQuote={onSelectQuote}
      />
    )

    fireEvent.click(screen.getByTestId('quote-row-LiFi'))
    expect(onSelectQuote).toHaveBeenCalledWith(best)
  })

  it('does nothing on row click when onSelectQuote is not provided', () => {
    const quotes = [makeQuote({ aggregator: 'LiFi' })]
    render(<QuoteComparison quotes={quotes} failures={[]} isLoading={false} decimals={18} />)

    const row = screen.getByTestId('quote-row-LiFi')
    expect(row).not.toHaveAttribute('role', 'button')
    fireEvent.click(row) // should not throw
  })
})
