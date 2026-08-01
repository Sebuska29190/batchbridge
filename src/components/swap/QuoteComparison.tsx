import React, { useState } from 'react'
import type { Quote } from '../../services/aggregators/types'
import { Skeleton } from '../common/Skeleton'
import { formatTokenAmount } from './format'

export interface QuoteComparisonProps {
  quotes: Quote[] // already sorted best-first by the caller (useQuote)
  failures: { aggregator: string; error: string }[]
  isLoading: boolean
  decimals: number // of the destination token, for formatting toAmount
  onSelectQuote?: (quote: Quote) => void // if the user can pick a non-best quote to execute instead; omit to just display
}

/** Percentage difference of `quote` from `best`, using netOutputUsd (the ranking basis). */
function deltaPercent(quote: Quote, best: Quote): number {
  if (best.netOutputUsd === 0) return 0
  return ((quote.netOutputUsd - best.netOutputUsd) / best.netOutputUsd) * 100
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(2)}%`
}

export const QuoteComparison: React.FC<QuoteComparisonProps> = ({
  quotes,
  failures,
  isLoading,
  decimals,
  onSelectQuote,
}) => {
  const [showAll, setShowAll] = useState(false)

  if (isLoading && quotes.length === 0) {
    return (
      <div className="flex flex-col gap-2" data-testid="quote-comparison-skeleton">
        <Skeleton variant="rectangular" height={64} />
        <Skeleton variant="rectangular" height={44} />
        <Skeleton variant="rectangular" height={44} />
      </div>
    )
  }

  if (quotes.length === 0 && failures.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-[var(--ink-3)]">
        Enter an amount to see quotes
      </div>
    )
  }

  const best = quotes[0] as Quote | undefined
  const collapsedQuotes = quotes.slice(1)
  const clickable = Boolean(onSelectQuote)

  const renderQuoteRow = (quote: Quote, isBest: boolean) => {
    const amount = formatTokenAmount(quote.toAmount, decimals)
    const delta = isBest || !best ? null : deltaPercent(quote, best)

    const interactiveProps = clickable
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onClick: () => onSelectQuote?.(quote),
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelectQuote?.(quote)
            }
          },
        }
      : {}

    return (
      <div
        key={quote.aggregator}
        data-testid={`quote-row-${quote.aggregator}`}
        className={[
          'flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2',
          isBest
            ? 'border border-[var(--accent)] bg-[var(--accent-wash)]'
            : 'border border-[var(--line)] bg-[var(--surface-2)]',
          clickable ? 'cursor-pointer hover:border-[var(--line-strong)]' : '',
        ].filter(Boolean).join(' ')}
        {...interactiveProps}
      >
        <span className="flex items-center gap-2 text-sm text-[var(--ink)]">
          {isBest && (
            <span
              data-testid="quote-best-badge"
              className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-ink)]"
            >
              Best
            </span>
          )}
          {quote.aggregator}
        </span>
        <span className="flex items-center gap-2">
          <span className="num text-sm text-[var(--ink)]">{amount}</span>
          {delta !== null && (
            <span
              className="num text-xs"
              style={{ color: delta < 0 ? 'var(--neg)' : delta > 0 ? 'var(--pos)' : 'var(--ink-3)' }}
            >
              {formatDelta(delta)}
            </span>
          )}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {best && renderQuoteRow(best, true)}

      {collapsedQuotes.length > 0 && (
        <>
          {showAll && (
            <div className="flex flex-col gap-2">
              {collapsedQuotes.map(quote => renderQuoteRow(quote, false))}
            </div>
          )}
          <button
            type="button"
            data-testid="quote-toggle"
            onClick={() => setShowAll(prev => !prev)}
            className="self-start text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
          >
            {showAll ? 'Hide' : `Show ${collapsedQuotes.length} more`}
          </button>
        </>
      )}

      {failures.map(failure => (
        <div
          key={failure.aggregator}
          data-testid={`quote-failure-${failure.aggregator}`}
          className="rounded-[var(--radius-sm)] px-3 py-2 text-xs text-[var(--ink-3)]"
        >
          {`${failure.aggregator} — ${failure.error}`}
        </div>
      ))}
    </div>
  )
}
