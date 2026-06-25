import { useSwap } from '../hooks/useSwap';

export default function SwapForm() {
  const swap = useSwap();

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
          <button className="token-select-btn" onClick={() => {}}>
            {swap.srcToken ? (
              <><img src={swap.srcToken.logo} alt="" className="token-icon-sm" />{swap.srcToken.symbol}</>
            ) : 'Select'}
          </button>
        </div>
        {swap.srcToken && (
          <div className="token-grid" style={{ marginTop: '8px' }}>
            {swap.SWAP_TOKEN_LIST.filter(t => t.address !== swap.dstToken?.address).map(token => (
              <button
                key={token.address}
                className={`token-chip ${swap.srcToken?.address === token.address ? 'active' : ''}`}
                onClick={() => swap.setSrcToken(token)}
              >
                <img src={token.logo} alt="" className="token-icon-sm" />
                {token.symbol}
              </button>
            ))}
          </div>
        )}
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
          <button className="token-select-btn" onClick={() => {}}>
            {swap.dstToken ? (
              <><img src={swap.dstToken.logo} alt="" className="token-icon-sm" />{swap.dstToken.symbol}</>
            ) : 'Select'}
          </button>
        </div>
        {swap.dstToken && (
          <div className="token-grid" style={{ marginTop: '8px' }}>
            {swap.SWAP_TOKEN_LIST.filter(t => t.address !== swap.srcToken?.address).map(token => (
              <button
                key={token.address}
                className={`token-chip ${swap.dstToken?.address === token.address ? 'active' : ''}`}
                onClick={() => swap.setDstToken(token)}
              >
                <img src={token.logo} alt="" className="token-icon-sm" />
                {token.symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quote Info */}
      {swap.quote && (
        <div className="quote-card glass-panel" style={{ padding: '12px' }}>
          <div className="quote-row">
            <span>Best route via</span>
            <span className="quote-val text-gradient">{swap.quote.provider} {swap.quote.route.join(' → ')}</span>
          </div>
          <div className="quote-row">
            <span>Estimated gas</span>
            <span>~{swap.quote.gas.slice(0, 6)} gwei</span>
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
    </div>
  );
}
