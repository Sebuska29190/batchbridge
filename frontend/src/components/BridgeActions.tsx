export default function BridgeActions({
  activeSelectionCount, MAX_BATCH_TOKENS, selectedTokens,
  outputToken, quote, isLoadingQuote, isBridging,
  slippage, customSlippage,
  onSlippageChange, onCustomSlippageChange,
  onGetQuote, onBridge, onBridgeAgain, onClose,
  getOutputAmount, getFees, status, bridgeProgress, bridgePanelMode, successPanel,
  SLIPPAGE_PRESETS,
}) {
  const getQuoteRouter = (currentQuote) =>
    currentQuote?.details?.route?.origin?.router ||
    currentQuote?.details?.route?.destination?.router || null

  return (
    <div className={`bridge-actions ${bridgePanelMode !== 'idle' ? 'panel-shifted' : ''}`}>
      <div className="bridge-actions-inner">
        {/* Main action panel */}
        <div className="action-panel">
          {/* Slippage */}
          <div className="slippage-section">
            <label className="section-label">Slippage Tolerance</label>
            <div className="slippage-options">
              {SLIPPAGE_PRESETS.map(p => (
                <button key={p.label}
                  className={`slip-btn ${slippage === p.value && !customSlippage ? 'active' : ''}`}
                  onClick={() => { onSlippageChange(p.value); onCustomSlippageChange('') }}
                >{p.label}</button>
              ))}
              <div className="slip-custom">
                <input type="number" placeholder="Custom" value={customSlippage}
                  onChange={(e) => onCustomSlippageChange(e.target.value)}
                  min="0.01" max="50" step="0.1" />
                <span>%</span>
              </div>
            </div>
          </div>

          {/* Quote display */}
          {quote && (
            <div className="quote-card">
              <div className="quote-row">
                <span>You receive</span>
                <span className="quote-val">
                  {getOutputAmount()?.amount} {outputToken?.symbol}
                  <span className="quote-usd"> (~${getOutputAmount()?.usd})</span>
                </span>
              </div>
              <div className="quote-row">
                <span>Network fee</span>
                <span>${getFees()?.gas}</span>
              </div>
              <div className="quote-row">
                <span>Relay fee</span>
                <span>${getFees()?.relay}</span>
              </div>
              <div className="quote-row total">
                <span>Total fees</span>
                <span>${getFees()?.total}</span>
              </div>
              {quote.details?.timeEstimate && (
                <div className="quote-row">
                  <span>~{quote.details.timeEstimate}s</span>
                </div>
              )}
              {quote.details?.route && (
                <div className="quote-route">
                  Route: {getQuoteRouter(quote) || 'Auto'}
                </div>
              )}
            </div>
          )}

          {/* Status message */}
          {bridgePanelMode === 'idle' && status.message && (
            <div className={`status-msg ${status.type}`}>{status.message}</div>
          )}

          {/* Action button */}
          <div className="action-btn-row">
            {!quote ? (
              <button className="btn-primary btn-lg"
                onClick={onGetQuote}
                disabled={activeSelectionCount === 0 || selectedTokens.size > MAX_BATCH_TOKENS || !outputToken || isLoadingQuote}
              >
                {isLoadingQuote ? (
                  <><span className="spin-icon-sm" /> Getting Quote...</>
                ) : 'Get Quote'}
              </button>
            ) : (
              <button className="btn-primary btn-lg btn-bridge"
                onClick={onBridge}
                disabled={isBridging}
              >
                {isBridging
                  ? <><span className="spin-icon-sm" /> Bridging...</>
                  : `Bridge ${activeSelectionCount} Token${activeSelectionCount > 1 ? 's' : ''}`
                }
              </button>
            )}
          </div>
          {selectedTokens.size > MAX_BATCH_TOKENS && (
            <p className="batch-warn">⚠️ Max {MAX_BATCH_TOKENS} tokens. Selected: {selectedTokens.size}</p>
          )}
        </div>

        {/* Status/Processing panel */}
        <div className={`status-panel ${bridgePanelMode !== 'idle' ? 'visible' : ''}`}>
          {bridgePanelMode === 'processing' && (
            <div className="status-content">
              <div className="status-icon processing">
                <svg className="spin-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="status-title">Processing</div>
              <div className="status-desc">{bridgeProgress?.message || 'Processing...'}</div>
            </div>
          )}
          {bridgePanelMode === 'success' && (
            <div className="status-content">
              <button className="status-close" onClick={onClose}>×</button>
              <div className="status-icon success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="status-title">{successPanel?.title || 'Bridge complete'}</div>
              {successPanel?.message && <div className="status-desc">{successPanel.message}</div>}
              <button className="btn-primary btn-sm" onClick={onBridgeAgain}>Bridge again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
