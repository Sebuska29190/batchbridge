import React from 'react'
import type { Quote } from '../../services/aggregators/types'
import { formatTokenAmount, formatUsd, formatDuration } from './format'

export interface RouteDetailsProps {
  quote: Quote | null
  fromDecimals: number
  toDecimals: number
  fromSymbol: string
  toSymbol: string
}

// NOTE: `fromDecimals` and `fromSymbol` are accepted per the required props
// interface but are currently unused - see the Rate row decision below.
//
// Rate row: omitted. A true rate needs the original input amount
// (1 fromSymbol = X toSymbol), but `Quote` doesn't carry the request amount
// at all, only output amounts. Rather than add an out-of-scope `fromAmount`
// prop or fabricate a number, this row is left out entirely.
//
// Price impact row: omitted. There's no field on `Quote` (or honest
// derivation from `netOutputUsd`/`estimatedGasUsd`/`feeUsd`) that represents
// impact vs. an unslippaged market price - inventing one would be a guess,
// not a number.

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] py-2 last:border-b-0">
      <dt className="text-sm text-[var(--ink-2)]">{label}</dt>
      <dd className="num text-sm text-[var(--ink)]">{value}</dd>
    </div>
  )
}

export const RouteDetails: React.FC<RouteDetailsProps> = ({ quote, toDecimals, toSymbol }) => {
  if (!quote) return null

  const minReceived = formatTokenAmount(quote.toAmountMin, toDecimals)
  const networkFee = `≈ ${formatUsd(quote.estimatedGasUsd)}`
  const bbFee = quote.feeUsd === 0 ? 'Free' : `≈ ${formatUsd(quote.feeUsd)}`
  const duration = formatDuration(quote.durationSeconds)

  return (
    <dl className="flex flex-col" data-testid="route-details">
      <DetailRow label="Minimum received" value={`${minReceived} ${toSymbol}`} />
      <DetailRow label="Network fee" value={networkFee} />
      <DetailRow label="BatchBridge fee" value={bbFee} />
      <DetailRow label="Estimated time" value={duration} />
    </dl>
  )
}
