import { BRIDGE_CHAINS } from '../wagmi'

export default function HeroSection({ onConnect }) {
  return (
    <div className="hero">
      <div className="hero-content">
        <div className="hero-badge">⚡ Batch Transactions</div>
        <h1 className="hero-title">Bridge tokens<br />across chains</h1>
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
            <div key={chain.id} className="hero-chain-pill" style={{ '--chain-color': chain.color }}>
              <img src={chain.logo} alt={chain.name} className="chain-logo-sm" />
              {chain.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
