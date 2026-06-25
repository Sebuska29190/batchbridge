export default function Navbar({ isConnected, address, connectedChainId, openWallet, openNetworks, disconnectWallet, locale, onLocaleChange, onShowHistory }) {
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
        <span className="logo-text">Batch<span className="logo-accent">Bridge</span></span>
      </div>
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
          {locale === 'en' ? 'PL' : 'EN'}
        </button>
        {!isConnected ? (
          <button className="btn-connect" onClick={openWallet}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <path d="M1 10h22" />
            </svg>
            Connect Wallet
          </button>
        ) : (
          <div className="connected-group">
            <button className="btn-chain" onClick={openNetworks}>
              {getChainById(connectedChainId)?.name || 'Unknown'}
            </button>
            <button className="btn-account" onClick={disconnectWallet}>
              <span className="account-dot" />
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

function getChainById(id) {
  const chains = [
    { id: 1, name: 'Ethereum' }, { id: 8453, name: 'Base' },
    { id: 42161, name: 'Arbitrum' }, { id: 10, name: 'Optimism' },
    { id: 137, name: 'Polygon' },
  ]
  return chains.find(c => c.id === Number(id))
}
