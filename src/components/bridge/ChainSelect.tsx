import { useEffect, useRef, useState } from 'react'
import { Button } from '../common/Button'
import { ChainIcon } from '../common/ChainIcon'
import type { ChainConfig } from '../../config/chains'

export interface ChainSelectProps {
  chains: ChainConfig[]
  selectedChainId: number
  onSelect: (chainId: number) => void
  excludeChainId?: number
  label?: string
}

export const ChainSelect: React.FC<ChainSelectProps> = ({
  chains,
  selectedChainId,
  onSelect,
  excludeChainId,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedChain = chains.find(c => c.id === selectedChainId)
  const visibleChains = chains.filter(c => c.id !== excludeChainId)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (chainId: number) => {
    onSelect(chainId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      {label && <div className="mb-1 text-xs font-medium text-[var(--ink-3)]">{label}</div>}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          {selectedChain ? (
            <>
              <ChainIcon logo={selectedChain.logo} name={selectedChain.name} size={20} />
              <span>{selectedChain.name}</span>
            </>
          ) : (
            <span>Select chain</span>
          )}
        </span>
      </Button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute z-10 mt-1 w-56 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow)]"
        >
          {visibleChains.map(chain => {
            const isSelected = chain.id === selectedChainId
            return (
              <button
                key={chain.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(chain.id)}
                className="flex w-full items-center gap-2 rounded-[calc(var(--radius-sm)-2px)] px-2 py-1.5 text-left text-sm text-[var(--ink)] hover:bg-[var(--surface-2)]"
              >
                <ChainIcon logo={chain.logo} name={chain.name} size={20} />
                <span className="flex-1">{chain.name}</span>
                {isSelected && (
                  <span className="text-[var(--accent)]" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
