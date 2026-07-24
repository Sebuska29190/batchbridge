import { useState, useMemo } from 'react'
import type { Token } from '../../types'

interface Props {
  tokens: Token[]
  selected: Token | null
  onSelect: (token: Token) => void
  balances?: Record<string, string>
  chainName?: string
}

export default function TokenSelector({ tokens, selected, onSelect, balances, chainName }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return tokens
    const q = search.toLowerCase()
    return tokens.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    )
  }, [tokens, search])

  return (
    <>
      <button className="token-select-btn" onClick={() => setOpen(true)}>
        {selected ? (
          <>
            <img src={selected.logo} alt={selected.symbol} className="token-select-icon"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="token-select-symbol">{selected.symbol}</span>
          </>
        ) : (
          <span className="token-select-placeholder">Select token</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card token-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Token {chainName ? `on ${chainName}` : ''}</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="token-modal-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, symbol, or address..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="token-modal-list">
              {filtered.length === 0 ? (
                <div className="token-modal-empty">No tokens found</div>
              ) : (
                filtered.map(token => {
                  const bal = balances?.[token.address]
                  const isSelected = selected?.address === token.address
                  return (
                    <button
                      key={token.address}
                      className={`token-modal-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => { onSelect(token); setOpen(false); setSearch('') }}
                    >
                      <img src={token.logo} alt={token.symbol} className="token-modal-icon"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <div className="token-modal-info">
                        <span className="token-modal-symbol">{token.symbol}</span>
                        <span className="token-modal-name">{token.name}</span>
                      </div>
                      {bal && (
                        <span className="token-modal-balance">{parseFloat(bal).toFixed(4)}</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
