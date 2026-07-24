import { useState } from 'react'
import { useSwap } from '../../hooks/useSwap'
import TokenSelector from '../shared/TokenSelector'
import SlippageControl from '../shared/SlippageControl'
import QuoteComparison from './QuoteComparison'

export default function SwapCard() {
  const s = useSwap()
  const [showSettings, setShowSettings] = useState(false)
  const [showQuotes, setShowQuotes] = useState(false)

  return (
    <div className="swap-card-wrapper">
      <div className="swap-card glass-card">
        <div className="swap-card-header">
          <h2>Swap</h2>
          <div className="swap-card-actions">
            <button className="swap-icon-btn" onClick={() => { s.setAmount(''); s.setError('') }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <button className={`swap-icon-btn ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(!showSettings)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
          </div>
        </div>

        {showSettings && (
          <SlippageControl value={s.slippage} customValue={s.customSlippage} onChange={s.setSlippage} onCustomChange={s.setCustomSlippage} />
        )}

        <div className="swap-input-box">
          <div className="swap-input-header">
            <span className="swap-input-label">You pay</span>
            {s.isConnected && (
              <span className="swap-input-balance">
                Balance: {parseFloat(s.walletBal).toFixed(4)}
                <button className="swap-max-btn" onClick={() => s.setAmount(s.walletBal)}>MAX</button>
              </span>
            )}
          </div>
          <div className="swap-input-row">
            <input
              type="number"
              placeholder="0"
              value={s.amount}
              onChange={e => { s.setAmount(e.target.value); s.setError('') }}
              className="swap-amount-input"
            />
            <TokenSelector
              tokens={s.tokens}
              selected={s.srcToken}
              onSelect={t => { s.setSrcToken(t); s.setError('') }}
              balances={s.balances}
              chainName={s.chainInfo?.name}
            />
          </div>
          {s.amount && parseFloat(s.amount) > parseFloat(s.walletBal) && (
            <div className="swap-insufficient">Insufficient balance</div>
          )}
        </div>

        <div className="swap-arrow-row">
          <button className="swap-arrow-btn" onClick={s.switchTokens}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
            </svg>
          </button>
        </div>

        <div className="swap-input-box">
          <div className="swap-input-header">
            <span className="swap-input-label">You receive</span>
            {s.dstToken && s.isConnected && (
              <span className="swap-input-balance">
                Balance: {parseFloat(s.balances[s.dstToken.address] || '0').toFixed(4)}
              </span>
            )}
          </div>
          <div className="swap-input-row">
            <div className="swap-amount-display">
              {s.quoteLoading ? (
                <span className="swap-fetching">Fetching...</span>
              ) : s.bestQuote ? (
                parseFloat(s.bestQuote.dstAmountFormatted).toFixed(6)
              ) : (
                <span className="swap-zero">0</span>
              )}
            </div>
            <TokenSelector
              tokens={s.tokens}
              selected={s.dstToken}
              onSelect={t => { s.setDstToken(t); s.setError('') }}
              balances={s.balances}
              chainName={s.chainInfo?.name}
            />
          </div>
        </div>

        {s.error && <div className="swap-error">{s.error}</div>}

        {s.txHash && (
          <div className="swap-tx-link">
            <a href={`${s.chainInfo?.explorer || 'https://basescan.org'}/tx/${s.txHash}`} target="_blank" rel="noopener noreferrer">
              View on Explorer ↗
            </a>
          </div>
        )}

        {s.bestQuote && !s.quoteLoading && (
          <>
            <div className="swap-quote-info">
              <div className="swap-quote-row">
                <span>Rate</span>
                <span>1 {s.srcToken?.symbol} ≈ {(parseFloat(s.bestQuote.dstAmountFormatted) / parseFloat(s.amount || '1')).toFixed(6)} {s.dstToken?.symbol}</span>
              </div>
              <div className="swap-quote-row">
                <span>Minimum received</span>
                <span>{(parseFloat(s.bestQuote.dstAmountFormatted) * (1 - s.slippage / 100)).toFixed(6)} {s.dstToken?.symbol}</span>
              </div>
              <div className="swap-quote-row">
                <span>Price Impact</span>
                <span className={parseFloat(s.bestQuote.priceImpact) > 5 ? 'text-warning' : 'text-success'}>
                  {s.bestQuote.priceImpact || '<0.01'}%
                </span>
              </div>
              <div className="swap-quote-row clickable" onClick={() => setShowQuotes(!showQuotes)}>
                <span>Route</span>
                <span className="text-accent">
                  {s.bestQuote.provider}
                  {s.allQuotes.length > 1 && ` (${s.allQuotes.length} sources)`}
                </span>
              </div>
            </div>
            {showQuotes && s.allQuotes.length > 1 && (
              <QuoteComparison
                quotes={s.allQuotes}
                bestProvider={s.bestQuote.provider}
                srcSymbol={s.srcToken?.symbol || ''}
                dstSymbol={s.dstToken?.symbol || ''}
              />
            )}
          </>
        )}

        <button
          className="swap-execute-btn"
          onClick={s.bestQuote ? s.handleSwap : undefined}
          disabled={!s.isConnected || !s.bestQuote || s.quoteLoading || s.isSwapping || (parseFloat(s.amount) > parseFloat(s.walletBal))}
        >
          {!s.isConnected ? 'Connect Wallet' :
           s.quoteLoading ? 'Getting Best Quote...' :
           s.isSwapping ? 'Confirm in Wallet...' :
           !s.bestQuote ? (s.amount ? 'No Route Found' : 'Enter Amount') :
           `Swap ${s.srcToken?.symbol} → ${s.dstToken?.symbol}`}
        </button>

        {s.bestQuote && (
          <div className="swap-powered-by">
            Powered by {s.allQuotes.map(q => q.provider).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
