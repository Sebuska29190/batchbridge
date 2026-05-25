import { memo } from 'react'
import { formatUsd } from '../bridgeService'

const CheckIcon = memo(() => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
))
CheckIcon.displayName = 'CheckIcon'

export default function TokenList({
  title,
  tokens,
  outputTokens,
  customTokens,
  outputToken,
  selectedTokens,
  isOutput,
  isLoading,
  isChecking,
  sourceChain,
  destChain,
  getChainById,
  onOutputTokenSelect,
  onToggleToken,
  onUpdateAmount,
  onSetMax,
  customAddress,
  onCustomAddressChange,
  onCustomAdd,
  isAddingCustom,
  customSourceAddress,
  onCustomSourceAddressChange,
  onCustomSourceAdd,
  isAddingSource,
  getBlockedReason,
  activeSelectionCount,
  selectedTotal,
  onRefresh,
  MAX_BATCH_TOKENS,
  showToast,
}) {
  const Loader = () => (
    <svg className="spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )

  if (isOutput) {
    return (
      <div className="token-panel">
        <div className="panel-header">
          <h3>Receive As</h3>
        </div>
        <div className="token-grid">
          {outputTokens.map(token => (
            <div
              key={token.address}
              className={`token-card ${outputToken?.address === token.address ? 'selected' : ''}`}
              onClick={() => onOutputTokenSelect(token)}
            >
              <div className="token-card-icon">
                {token.logo ? (
                  <img src={token.logo} alt={token.symbol}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                ) : null}
                <span className="token-icon-fallback" style={{ display: token.logo ? 'none' : 'flex' }}>
                  {token.symbol.charAt(0)}
                </span>
              </div>
              <div className="token-card-info">
                <span className="token-card-symbol">{token.symbol}</span>
                <span className="token-card-name">{token.name}</span>
              </div>
              {outputToken?.address === token.address && <div className="token-card-check"><CheckIcon /></div>}
            </div>
          ))}
          {customTokens.map(token => (
            <div key={token.address}
              className={`token-card custom ${outputToken?.address === token.address ? 'selected' : ''}`}
              onClick={() => onOutputTokenSelect(token)}>
              <div className="token-card-icon">
                <span className="token-icon-fallback">C</span>
              </div>
              <div className="token-card-info">
                <span className="token-card-symbol">{token.symbol}</span>
                <span className="token-card-name">{token.name}</span>
              </div>
              {outputToken?.address === token.address && <div className="token-card-check"><CheckIcon /></div>}
            </div>
          ))}
        </div>
        <div className="custom-token-bar">
          <input type="text" placeholder="Add custom token (0x...)" value={customAddress}
            onChange={(e) => onCustomAddressChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCustomAdd()}
            disabled={isAddingCustom} />
          <button onClick={onCustomAdd} disabled={!customAddress.trim() || isAddingCustom}>
            {isAddingCustom ? <Loader /> : '+'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="token-panel">
      <div className="panel-header">
        <h3>Select Tokens to Bridge</h3>
        <button className="btn-text" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>
      {!outputToken && <div className="route-hint">Select a Receive As token first</div>}
      <div className="token-list">
        {isLoading ? (
          <div className="loading-state"><Loader /><span>Loading tokens...</span></div>
        ) : tokens.length === 0 ? (
          <div className="empty-state">
            <p>No tokens found on {getChainById(sourceChain)?.name}</p>
          </div>
        ) : (
          tokens.map(token => {
            const sel = selectedTokens.get(token.address)
            const amountValue = sel ? Number(sel.amountInput || 0) : null
            const displayUsd = sel && Number.isFinite(amountValue) ? (amountValue * (token.price || 0)) : token.valueUsd
            const blockedReason = getBlockedReason(token, sourceChain)
            const isBlocked = Boolean(blockedReason)
            const isUnavail = token.routeAvailable === false || isBlocked
            return (
              <div key={token.address}
                className={`token-row ${selectedTokens.has(token.address) ? 'selected' : ''} ${isUnavail ? 'unavailable' : ''} ${isChecking ? 'disabled' : ''}`}
                onClick={() => {
                  if (isChecking) return
                  if (!outputToken) { showToast('Select output token first'); return }
                  if (isBlocked) { showToast(blockedReason); return }
                  if (token.routeAvailable === false) return
                  onToggleToken(token)
                }}
              >
                <div className="token-row-info">
                  <div className="token-icon-sm">
                    {token.logo ? (
                      <img src={token.logo} alt={token.symbol}
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                    ) : null}
                    <span className="token-icon-fallback" style={{ display: token.logo ? 'none' : 'flex' }}>
                      {token.symbol.charAt(0)}
                    </span>
                  </div>
                  <div className="token-row-details">
                    <span className="token-row-symbol">{token.symbol}</span>
                    <span className="token-row-balance">{token.balanceFormatted}</span>
                  </div>
                </div>
                <div className="token-row-value">
                  {isBlocked ? <span className="badge-error">{blockedReason}</span>
                    : token.routeAvailable === false
                      ? <span className="badge-warn">No route</span>
                      : formatUsd(displayUsd)
                  }
                </div>
                {sel && (
                  <div className="token-row-amount" onClick={e => e.stopPropagation()}>
                    <input type="text" inputMode="decimal" placeholder="0.00"
                      value={sel.amountInput || ''}
                      onChange={e => onUpdateAmount(token.address, e.target.value)} />
                    <button type="button" className="btn-max" onClick={() => onSetMax(token.address)}>Max</button>
                  </div>
                )}
                <div className="token-row-check">
                  {selectedTokens.has(token.address) && <CheckIcon />}
                </div>
              </div>
            )
          })
        )}
      </div>
      <div className="custom-token-bar">
        <input type="text" placeholder="Add token by address (0x...)" value={customSourceAddress}
          onChange={(e) => onCustomSourceAddressChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCustomSourceAdd()}
          disabled={isAddingSource} />
        <button onClick={onCustomSourceAdd} disabled={!customSourceAddress.trim() || isAddingSource}>
          {isAddingSource ? <Loader /> : '+'}
        </button>
      </div>
      {activeSelectionCount > 0 && (
        <div className="panel-footer">
          <span>{activeSelectionCount} token{activeSelectionCount > 1 ? 's' : ''} selected</span>
          <span className="total-value">{formatUsd(selectedTotal)}</span>
        </div>
      )}
    </div>
  )
}
