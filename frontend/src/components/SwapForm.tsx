import { useState } from 'react';
import { useSwap } from '../hooks/useSwap';
import { TokenModal } from './TokenModal';

export default function SwapForm() {
  const swap = useSwap();
  const [showSrcModal, setShowSrcModal] = useState(false);
  const [showDstModal, setShowDstModal] = useState(false);

  return (
    <div className="swap-container">
      {/* Source Token */}
      <div className="swap-section glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius)' }}>
        <div className="swap-label">You pay</div>
        <div className="swap-input-row">
          <input
            type="number"
            placeholder="0.0"
            value={swap.amount}
            onChange={(e) => swap.setAmount(e.target.value)}
            className="swap-amount-input"
            min="0"
          />
          <button className="token-select-btn" onClick={() => setShowSrcModal(true)}>
            {swap.srcToken ? (
              <><img src={swap.srcToken.logo} alt="" className="token-icon-sm" />{swap.srcToken.symbol}</>
            ) : 'Select'}
          </button>
        </div>
      </div>

      {/* Swap Direction */}
      <div className="swap-arrow-row">
        <button className="swap-arrow-btn" onClick={swap.swapTokens} title="Swap tokens">
          ↓↑
        </button>
      </div>

      {/* Destination Token */}
      <div className="swap-section glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius)' }}>
        <div className="swap-label">You receive</div>
        <div className="swap-input-row">
          <div className="swap-output-amount">
            {swap.quote ? swap.quote.dstAmountFormatted.slice(0, 10) : '0.0'}
          </div>
          <button className="token-select-btn" onClick={() => setShowDstModal(true)}>
            {swap.dstToken ? (
              <><img src={swap.dstToken.logo} alt="" className="token-icon-sm" />{swap.dstToken.symbol}</>
            ) : 'Select'}
          </button>
        </div>
      </div>

      {/* Quote Info + Comparison */}
      {swap.quote && swap.allQuotes.length > 1 && (
        <div className="quote-card glass-panel" style={{ padding: '12px' }}>
          <div className="quote-row" style={{ fontWeight: 600, marginBottom: '8px' }}>
            <span>Best via</span>
            <span className="text-gradient">{swap.quote.provider}</span>
          </div>
          {swap.allQuotes.map((q, i) => (
            <div key={q.provider} className="quote-row" style={{
              opacity: q.provider === swap.quote?.provider ? 1 : 0.6,
              padding: '4px 0', borderBottom: i < swap.allQuotes.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {q.provider} {q.route[0] ? `(${q.route[0]})` : ''}
                {q.provider === swap.quote?.provider && <span style={{ fontSize: '10px', color: 'var(--success)' }}>BEST</span>}
              </span>
              <span>{q.dstAmountFormatted.slice(0, 10)} {swap.dstToken?.symbol}</span>
            </div>
          ))}
          <div className="quote-row" style={{ marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '6px', fontSize: '12px' }}>
            <span>Gas estimate</span>
            <span>{swap.quote.gas.slice(0, 8)} gwei</span>
          </div>
        </div>
      )}

      {swap.quote && swap.allQuotes.length <= 1 && (
        <div className="quote-card glass-panel" style={{ padding: '12px' }}>
          <div className="quote-row">
            <span>Route via</span>
            <span className="text-gradient">{swap.quote.provider} {swap.quote.route.join(' → ')}</span>
          </div>
          <div className="quote-row">
            <span>Output</span>
            <span className="quote-val">{swap.quote.dstAmountFormatted.slice(0, 10)} {swap.dstToken?.symbol}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {swap.error && (
        <div className="status-msg error">{swap.error}</div>
      )}

      {/* Slippage */}
      <div className="slippage-section">
        <div className="slippage-options">
          {swap.SWAP_SLIPPAGE_PRESETS.map(p => (
            <button
              key={p.label}
              className={`slip-btn ${swap.slippage === p.value && !swap.customSlippage ? 'active' : ''}`}
              onClick={() => { swap.setSlippage(p.value); swap.setCustomSlippage(''); }}
            >
              {p.label}
            </button>
          ))}
          <div className="slip-custom">
            <input
              type="number" placeholder="Custom" value={swap.customSlippage}
              onChange={(e) => {
                swap.setCustomSlippage(e.target.value);
                const v = Number(e.target.value);
                if (Number.isFinite(v)) swap.setSlippage(Math.min(Math.max(v, 0.01), 50));
              }}
              min="0.01" max="50" step="0.1"
            />
            <span>%</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-btn-row">
        {!swap.quote ? (
          <button
            className="btn-primary btn-lg pulse-glow"
            onClick={swap.handleGetQuote}
            disabled={!swap.srcToken || !swap.dstToken || !swap.amount || swap.isLoadingQuote}
          >
            {swap.isLoadingQuote ? (
              <><span className="spin-icon-sm" /> Getting Quote...</>
            ) : 'Get Quote'}
          </button>
        ) : (
          <button
            className="btn-primary btn-lg pulse-glow"
            onClick={swap.handleSwap}
            disabled={swap.isSwapping || !swap.isConnected}
          >
            {swap.isSwapping ? (
              <><span className="spin-icon-sm" /> {swap.status || 'Swapping...'}</>
            ) : !swap.isConnected ? 'Connect Wallet' : 'Swap'}
          </button>
        )}
      </div>

      {/* TX Link */}
      {swap.txHash && (
        <div style={{ textAlign: 'center', padding: '8px' }}>
          <a
            href={`https://basescan.org/tx/${swap.txHash}`}
            target="_blank"
            className="quote-val"
            style={{ fontSize: '13px' }}
          >
            View on Basescan ↗
          </a>
        </div>
      )}

      {/* Token Selection Modals */}
      {showSrcModal && (
        <TokenModal
          tokens={swap.SWAP_TOKEN_LIST.filter(t => t.address !== swap.dstToken?.address)}
          selected={swap.srcToken}
          onSelect={(t) => { swap.setSrcToken(t); setShowSrcModal(false); }}
          onClose={() => setShowSrcModal(false)}
          title="Select token to pay"
        />
      )}
      {showDstModal && (
        <TokenModal
          tokens={swap.SWAP_TOKEN_LIST.filter(t => t.address !== swap.srcToken?.address)}
          selected={swap.dstToken}
          onSelect={(t) => { swap.setDstToken(t); setShowDstModal(false); }}
          onClose={() => setShowDstModal(false)}
          title="Select token to receive"
        />
      )}
    </div>
  );
}
