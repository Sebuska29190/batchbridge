import { BRIDGE_CHAINS } from '../wagmi'

const SwapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)

export default function ChainSelector({ sourceChain, destChain, onSourceChange, onDestChange, onSwap, disabled }) {
  return (
    <div className="chain-selector-row">
      <div className="chain-selector">
        <label className="chain-label">From</label>
        <div className="chain-options">
          {BRIDGE_CHAINS.map(chain => (
            <button
              key={chain.id}
              className={`chain-option ${sourceChain === chain.id ? 'active' : ''}`}
              style={{ '--chain-color': chain.color }}
              onClick={() => { if (chain.id !== sourceChain) onSourceChange(chain.id) }}
              disabled={disabled}
            >
              <img src={chain.logo} alt={chain.name} className="chain-logo"
                onError={(e) => { e.target.style.display = 'none' }} />
              <span>{chain.name}</span>
            </button>
          ))}
        </div>
      </div>
      <button className="chain-swap-btn" onClick={onSwap} disabled={disabled}>
        <SwapIcon />
      </button>
      <div className="chain-selector">
        <label className="chain-label">To</label>
        <div className="chain-options">
          {BRIDGE_CHAINS.map(chain => (
            <button
              key={chain.id}
              className={`chain-option ${destChain === chain.id ? 'active' : ''}`}
              style={{ '--chain-color': chain.color }}
              onClick={() => { if (chain.id !== destChain) onDestChange(chain.id) }}
              disabled={disabled}
            >
              <img src={chain.logo} alt={chain.name} className="chain-logo"
                onError={(e) => { e.target.style.display = 'none' }} />
              <span>{chain.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
