export default function Navbar({
  isConnected, address, connectedChainId,
  openWallet, openNetworks, disconnectWallet,
  locale, onLocaleChange, onShowHistory,
  mode, onModeChange,
}: {
  isConnected: boolean; address?: string; connectedChainId?: number;
  openWallet: () => void; openNetworks: () => void; disconnectWallet: () => void;
  locale: string; onLocaleChange: (l: string) => void; onShowHistory: () => void;
  mode?: string; onModeChange?: (m: string) => void;
}) {
  return (
    <nav className="navbar">
      <div className="logo" onClick={onShowHistory} style={{ cursor: 'pointer' }}>
        <div className="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </div>
        <span className="logo-text">Batch<span className="logo-accent">{mode === 'swap' ? 'Swap' : 'Bridge'}</span></span>
      </div>

      {/* Mode Tabs */}
      {onModeChange && (
        <div className="mode-tabs" style={{ display: 'flex', gap: '2px', background: 'var(--bg-card)', borderRadius: 'var(--radius-full)', padding: '3px' }}>
          <button
            onClick={() => onModeChange('swap')}
            className={`mode-tab ${mode === 'swap' ? 'active' : ''}`}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-full)', border: 'none',
              background: mode === 'swap' ? 'var(--accent)' : 'transparent',
              color: mode === 'swap' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
              fontWeight: 600, fontSize: '13px', transition: 'all 0.15s',
            }}
          >Swap</button>
          <button
            onClick={() => onModeChange('bridge')}
            className={`mode-tab ${mode === 'bridge' ? 'active' : ''}`}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-full)', border: 'none',
              background: mode === 'bridge' ? 'var(--accent)' : 'transparent',
              color: mode === 'bridge' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
              fontWeight: 600, fontSize: '13px', transition: 'all 0.15s',
            }}
          >Bridge</button>
        </div>
      )}

      <div className="nav-actions">
        {isConnected && (
          <button className="btn-icon" onClick={onShowHistory} title="Transaction History">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        )}
        <button className="btn-locale" onClick={() => onLocaleChange(locale === 'en' ? 'pl' : 'en')}>
          {locale.toUpperCase()}
        </button>
        {!isConnected ? (
          <button className="btn-connect" onClick={openWallet}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" />
            </svg>
            Connect
          </button>
        ) : (
          <div className="connected-group">
            <button className="btn-chain" onClick={openNetworks}>
              Chain {connectedChainId}
            </button>
            <button className="btn-account" onClick={disconnectWallet}>
              <span className="account-dot" />
              {address?.slice(0,6)}...{address?.slice(-4)}
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
