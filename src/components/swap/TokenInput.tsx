import React from 'react'
import { TokenIcon } from '../common/TokenIcon'
import { Skeleton } from '../common/Skeleton'
import type { Token } from '../../services/tokenRegistry'

export interface TokenInputProps {
  label: string // "You pay" / "You receive"
  amount: string // controlled value, human-readable decimal string (e.g. "10.5"), not wei
  onAmountChange?: (value: string) => void // omit/undefined for a read-only side (e.g. the "receive" side showing a quote's output)
  token: Token | null
  onTokenClick: () => void // opens the token picker - this component doesn't own that modal, just triggers it
  balance?: string // human-readable decimal string, e.g. "248.10"
  usdValue?: number
  readOnly?: boolean
  isLoadingAmount?: boolean // e.g. while a quote is being fetched for the receive side
}

// Digits with at most one '.', allowing empty string and a trailing '.' while
// the user is mid-edit (e.g. typing "10.") - rejects anything with a letter
// or a second decimal point.
const VALID_DECIMAL_RE = /^\d*\.?\d*$/

export const TokenInput: React.FC<TokenInputProps> = ({
  label,
  amount,
  onAmountChange,
  token,
  onTokenClick,
  balance,
  usdValue,
  readOnly = false,
  isLoadingAmount = false,
}) => {
  const isEditable = !readOnly && Boolean(onAmountChange)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    if (!VALID_DECIMAL_RE.test(value)) {
      // Force the DOM back to the last valid value immediately - the change
      // already landed in the input before this handler ran, and without a
      // parent re-render nothing else would revert it.
      event.target.value = amount
      return
    }
    onAmountChange?.(value)
  }

  const handleMax = () => {
    if (balance !== undefined) onAmountChange?.(balance)
  }

  return (
    <div className="field rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between text-sm text-[var(--ink-2)]">
        <span>{label}</span>
        {balance !== undefined && onAmountChange && (
          <span className="flex items-center gap-2">
            <span className="num">Balance: {balance}</span>
            <button
              type="button"
              onClick={handleMax}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-wash)]"
            >
              MAX
            </button>
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        {isLoadingAmount ? (
          <Skeleton width={100} height={32} />
        ) : isEditable ? (
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={amount}
            onChange={handleChange}
            placeholder="0"
            className="num min-w-0 flex-1 bg-transparent text-3xl font-medium text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
          />
        ) : (
          <span className="num flex-1 truncate text-3xl font-medium text-[var(--ink)]">{amount || '0'}</span>
        )}

        <button
          type="button"
          onClick={onTokenClick}
          className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 hover:border-[var(--line-strong)]"
        >
          {token ? (
            <>
              <TokenIcon logoURI={token.logoURI} symbol={token.symbol} size={22} />
              <span className="font-medium text-[var(--ink)]">{token.symbol}</span>
            </>
          ) : (
            <span className="font-medium text-[var(--ink)]">Select token</span>
          )}
        </button>
      </div>

      {usdValue !== undefined && (
        <div className="num mt-1 text-sm text-[var(--ink-3)]">≈ ${usdValue.toFixed(2)}</div>
      )}
    </div>
  )
}
