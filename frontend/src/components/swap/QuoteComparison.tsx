import type { AggregatorResult } from '../../services/aggregator'

interface Props {
  quotes: AggregatorResult[]
  bestProvider: string
  srcSymbol: string
  dstSymbol: string
}

export default function QuoteComparison({ quotes, bestProvider, srcSymbol, dstSymbol }: Props) {
  if (quotes.length <= 1) return null

  return (
    <div className="quote-comparison">
      <div className="quote-comparison-header">
        <span className="quote-comparison-title">Best Route</span>
        <span className="quote-comparison-count">{quotes.length} sources</span>
      </div>
      <div className="quote-comparison-list">
        {quotes.map((q, i) => (
          <div key={q.provider} className={`quote-comparison-item ${q.provider === bestProvider ? 'best' : ''}`}>
            <div className="quote-comp-left">
              <span className="quote-comp-provider">{q.provider}</span>
              {q.provider === bestProvider && <span className="quote-comp-badge">BEST</span>}
            </div>
            <div className="quote-comp-right">
              <span className="quote-comp-amount">{parseFloat(q.dstAmountFormatted).toFixed(4)} {dstSymbol}</span>
              <span className="quote-comp-gas">~${parseFloat(q.gasUsd || '0').toFixed(2)} gas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
