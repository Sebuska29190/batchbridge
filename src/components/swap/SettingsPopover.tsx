import React, { useEffect, useRef, useState } from 'react'

export interface SettingsPopoverProps {
  slippageBps: number | null // null = "Auto"
  onSlippageChange: (bps: number | null) => void
  isOpen: boolean
  onClose: () => void
}

const PRESETS: { label: string; bps: number | null }[] = [
  { label: 'Auto', bps: null },
  { label: '0.5%', bps: 50 },
  { label: '1%', bps: 100 },
  { label: '3%', bps: 300 },
]

// Only digits and a single optional decimal point - mirrors the careful
// numeric-input guard used elsewhere in this codebase (e.g. TokenInput),
// written locally since these components don't share code.
const CUSTOM_SLIPPAGE_PATTERN = /^\d*\.?\d*$/

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({
  slippageBps,
  onSlippageChange,
  isOpen,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [customValue, setCustomValue] = useState('')

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCustomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    if (raw !== '' && !CUSTOM_SLIPPAGE_PATTERN.test(raw)) return
    setCustomValue(raw)

    if (raw === '' || raw === '.') return
    const parsed = Number(raw)
    if (Number.isNaN(parsed) || parsed < 0) return
    onSlippageChange(Math.round(parsed * 100))
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Slippage settings"
      className="absolute z-10 mt-1 w-64 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]"
    >
      <div className="mb-2 text-xs font-medium text-[var(--ink-3)]">Slippage tolerance</div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(preset => {
          const isSelected = preset.bps === slippageBps
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                setCustomValue('')
                onSlippageChange(preset.bps)
              }}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:border-[var(--line-strong)]',
              ].join(' ')}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-[var(--ink-2)]">
        Custom
        <input
          type="text"
          inputMode="decimal"
          value={customValue}
          onChange={handleCustomChange}
          placeholder="0.00"
          aria-label="Custom slippage percentage"
          className="num w-16 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-right text-sm text-[var(--ink)] focus:border-[var(--accent)]"
        />
        %
      </label>
    </div>
  )
}
