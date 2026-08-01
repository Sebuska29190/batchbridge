import { formatUnits } from 'viem'

/**
 * Formats a smallest-unit (wei) integer string as a human-readable token
 * amount. Uses viem's formatUnits (BigInt-based, no precision loss) then
 * trims to `maxFractionDigits` for display - this isn't building the actual
 * transaction, just showing the user a reasonable number.
 */
export function formatTokenAmount(amountWei: string, decimals: number, maxFractionDigits = 6): string {
  let full: string
  try {
    full = formatUnits(BigInt(amountWei), decimals)
  } catch {
    return '0'
  }

  const [whole, fraction = ''] = full.split('.')
  if (!fraction) return whole
  const trimmedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, '')
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

/** Formats a USD number as `$X.XX`. */
export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`
}

/** Formats a duration in seconds humanely: `< 1 min` under a minute, `~N min` above. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return '< 1 min'
  return `~${Math.round(seconds / 60)} min`
}
