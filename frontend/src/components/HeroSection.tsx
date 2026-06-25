import { BRIDGE_CHAINS } from '../wagmi'

export default function HeroSection({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="hero hero-gradient">
      <div className="hero-content" style={{ position: 'relative', zIndex: 1 }}>
        <div className="hero-badge pulse-glow">⚡ Batch Transactions</div>
        <h1 className="hero-title">
          Bridge tokens
          <br />
          <span className="text-gradient">across chains</span>
        </h1>
        <p className="hero-subtitle">
          Select multiple tokens and bridge them in a single EIP-5792 transaction
        </p>
        <button className="hero-cta pulse-glow" onClick={onConnect}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <path d="M1 10h22" />
          </svg>
          Start Bridging
        </button>
        <div className="hero-chains">
          {BRIDGE_CHAINS.map(chain => (
            <div key={chain.id} className="hero-chain-pill glass-panel" style={{ '--chain-color': chain.color } as React.CSSProperties}>
              <img src={chain.logo} alt={chain.name} className="chain-logo-sm" />
              {chain.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
