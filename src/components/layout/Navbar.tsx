import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from '../common/Button'
import { ThemeToggle } from '../common/ThemeToggle'

export type AppMode = 'swap' | 'bridge' | 'batch'

export interface NavbarProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  isConnected: boolean
  address?: string
  onConnectClick: () => void
  onDisconnectClick?: () => void
}

const MODES: { value: AppMode; label: string }[] = [
  { value: 'swap', label: 'Swap' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'batch', label: 'Batch' },
]

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export const Navbar: React.FC<NavbarProps> = ({
  mode,
  onModeChange,
  isConnected,
  address,
  onConnectClick,
  onDisconnectClick,
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + direction + MODES.length) % MODES.length
    onModeChange(MODES[nextIndex].value)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <nav className="flex items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex shrink-0 items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
        <span className="hidden font-semibold text-[var(--ink)] sm:inline">BatchBridge</span>
      </div>

      <div
        role="tablist"
        aria-label="Mode"
        className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-1"
      >
        {MODES.map((m, index) => {
          const selected = m.value === mode
          return (
            <button
              key={m.value}
              ref={el => {
                tabRefs.current[index] = el
              }}
              role="tab"
              type="button"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onModeChange(m.value)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              className={`rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        {isConnected ? (
          <Button type="button" variant="secondary" onClick={() => onDisconnectClick?.()}>
            <span className="num">{address ? truncateAddress(address) : 'Connected'}</span>
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={onConnectClick}>
            Connect Wallet
          </Button>
        )}
      </div>
    </nav>
  )
}
