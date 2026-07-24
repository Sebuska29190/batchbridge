import type { AppRoute } from '../types'

interface Props {
  route: AppRoute
  onRouteChange: (route: AppRoute) => void
  isConnected: boolean
  address?: string
  connectedChainId?: number
  openWallet: () => void
  openNetworks: () => void
  disconnectWallet: () => void
  locale: string
  onLocaleChange: (l: string) => void
}

const NAV_ITEMS: { id: AppRoute; label: string }[] = [
  { id: 'swap', label: 'Swap' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'analytics', label: 'Analytics' },
]

export default function Navbar({
  route, onRouteChange, isConnected, address,
  openWallet, openNetworks, disconnectWallet,
  locale, onLocaleChange,
}: Props) {
  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => onRouteChange('swap')} style={{ cursor: 'pointer' }}>
        <div className="navbar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </div>
        <span className="navbar-title">Batch<span className="navbar-accent">Bridge</span></span>
      </div>

      <div className="navbar-tabs">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`navbar-tab ${route === item.id ? 'active' : ''}`}
            onClick={() => onRouteChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="navbar-actions">
        {isConnected && (
          <button className="navbar-btn navbar-btn-icon" onClick={openNetworks} title="Switch Network">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        )}
        <button className="navbar-btn navbar-locale" onClick={() => onLocaleChange(locale === 'en' ? 'pl' : 'en')}>
          {locale.toUpperCase()}
        </button>
        {!isConnected ? (
          <button className="navbar-btn navbar-connect" onClick={openWallet}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" />
            </svg>
            Connect
          </button>
        ) : (
          <button className="navbar-btn navbar-account" onClick={disconnectWallet}>
            <span className="navbar-dot" />
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        )}
      </div>
    </nav>
  )
}
