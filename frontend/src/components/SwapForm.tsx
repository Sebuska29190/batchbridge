import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getQuote, getSwapTx, fetchBalance, SWAP_TOKENS, SWAP_SLIPPAGE_PRESETS } from '../swapService';
import type { SwapToken, SwapQuote } from '../swapService';
import { TokenModal } from './TokenModal';

export default function SwapForm() {
  const { address, isConnected } = useAccount();

  const [srcToken, setSrcToken] = useState<SwapToken>(SWAP_TOKENS[0]); // ETH
  const [dstToken, setDstToken] = useState<SwapToken>(SWAP_TOKENS[1]); // USDC
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [balance, setBalance] = useState<string | null>(null);
  const [dstBalance, setDstBalance] = useState<string | null>(null);

  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');

  const [showSrcModal, setShowSrcModal] = useState(false);
  const [showDstModal, setShowDstModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch balance
  useEffect(() => {
    if (!address) { setBalance(null); return; }
    fetchBalance(address, srcToken).then(setBalance);
  }, [address, srcToken]);

  useEffect(() => {
    if (!address) { setDstBalance(null); return; }
    fetchBalance(address, dstToken).then(setDstBalance);
  }, [address, dstToken]);

  function swapTokens() {
    setSrcToken(dstToken);
    setDstToken(srcToken);
    setQuote(null); setAmount('');
  }

  function setMax() { if (balance) setAmount(balance); }

  async function handleQuote() {
    if (!amount || parseFloat(amount) <= 0) { setError('Enter an amount'); return; }
    setError(''); setLoading(true); setQuote(null);
    try {
      const q = await getQuote(srcToken, dstToken, amount);
      if (!q) setError('No route found for this pair');
      else setQuote(q);
    } catch (e: any) { setError(e?.message || 'Failed'); }
    finally { setLoading(false); }
  }

  async function handleSwap() {
    if (!address) { setError('Connect wallet'); return; }
    setError(''); setSwapping(true);
    try {
      const q = await getSwapTx(srcToken, dstToken, amount, address, slippage);
      if (!q?.txData) { setError('Failed to get swap data'); setSwapping(false); return; }
      // Use ethereum provider
      const win = window as any;
      if (!win.ethereum) { setError('No wallet detected'); setSwapping(false); return; }
      const tx = await win.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: q.txData.to, data: q.txData.data, value: '0x' + q.txData.value.toString(16) }],
      });
      setTxHash(tx);
      setQuote(null); setAmount('');
    } catch (e: any) {
      if (e?.code === 4001) setError('Cancelled');
      else setError(e?.message || 'Swap failed');
    } finally { setSwapping(false); }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
      {/* Swap Card */}
      <div style={{
        background: 'rgba(13,17,23,0.95)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)',
        padding: '8px', boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Sell */}
        <div style={{ padding: '16px', borderRadius: '20px', background: 'rgba(22,27,34,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#8b949e' }}>Sell</span>
            {balance && <span style={{ fontSize: '13px', color: '#8b949e' }}>
              Balance: {parseFloat(balance).toFixed(4)}{' '}
              <button onClick={setMax} style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>MAX</button>
            </span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="number" placeholder="0" value={amount}
              onChange={e => { setAmount(e.target.value); setQuote(null); }}
              style={{
                flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '36px', fontWeight: 500,
                fontFamily: 'Inter, sans-serif', outline: 'none', width: 0,
              }}
            />
            <button onClick={() => setShowSrcModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px 8px 8px',
              borderRadius: '100px', background: 'rgba(56,152,255,0.15)', border: '1px solid rgba(56,152,255,0.25)',
              color: '#58a6ff', fontWeight: 600, fontSize: '16px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <img src={srcToken.logo} style={{ width: '24px', height: '24px', borderRadius: '50%' }} alt="" />
              {srcToken.symbol} <span style={{ fontSize: '12px' }}>▼</span>
            </button>
          </div>
          {amount && balance && parseFloat(amount) > parseFloat(balance) && (
            <div style={{ color: '#f85149', fontSize: '12px', marginTop: '6px' }}>Insufficient balance</div>
          )}
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-12px 0', zIndex: 1, position: 'relative' }}>
          <button onClick={swapTokens} style={{
            width: '40px', height: '40px', borderRadius: '12px', border: '4px solid rgba(13,17,23,0.95)',
            background: 'rgba(22,27,34,1)', color: '#8b949e', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '18px',
          }}>↓</button>
        </div>

        {/* Buy */}
        <div style={{ padding: '16px', borderRadius: '20px', background: 'rgba(22,27,34,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#8b949e' }}>Buy</span>
            {dstBalance && <span style={{ fontSize: '13px', color: '#8b949e' }}>Balance: {parseFloat(dstBalance).toFixed(4)}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, fontSize: '36px', fontWeight: 500, color: quote ? '#fff' : '#484f58' }}>
              {quote ? parseFloat(quote.dstAmountFormatted).toFixed(6) : '0'}
            </div>
            <button onClick={() => setShowDstModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px 8px 8px',
              borderRadius: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff', fontWeight: 600, fontSize: '16px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <img src={dstToken.logo} style={{ width: '24px', height: '24px', borderRadius: '50%' }} alt="" />
              {dstToken.symbol} <span style={{ fontSize: '12px', color: '#8b949e' }}>▼</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quote details */}
      {quote && (
        <div style={{ margin: '12px 0', padding: '12px 16px', borderRadius: '16px', background: 'rgba(13,17,23,0.95)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
            <span style={{ color: '#8b949e' }}>Rate</span>
            <span style={{ color: '#fff' }}>1 {srcToken.symbol} ≈ {quote.dstAmountFormatted ? (parseFloat(quote.dstAmountFormatted) / parseFloat(amount || '1')).toFixed(6) : '0'} {dstToken.symbol}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
            <span style={{ color: '#8b949e' }}>Route</span>
            <span style={{ color: '#58a6ff' }}>ParaSwap {quote.route.length > 0 ? `→ ${quote.route.join(' → ')}` : ''}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
            <span style={{ color: '#8b949e' }}>Gas</span>
            <span style={{ color: '#fff' }}>{quote.gasUsd}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div style={{ color: '#f85149', fontSize: '13px', padding: '8px 0', textAlign: 'center' }}>{error}</div>}

      {/* TX link */}
      {txHash && (
        <div style={{ textAlign: 'center', padding: '8px' }}>
          <a href={`https://basescan.org/tx/${txHash}`} target="_blank" style={{ color: '#58a6ff', fontSize: '13px' }}>
            View on Basescan ↗
          </a>
        </div>
      )}

      {/* Action */}
      <button
        onClick={!quote ? handleQuote : handleSwap}
        disabled={(!isConnected && !quote) || loading || swapping || (amount && balance && parseFloat(amount) > parseFloat(balance))}
        style={{
          width: '100%', padding: '18px', marginTop: '8px', borderRadius: '20px', border: 'none',
          background: (!quote ? '#58a6ff' : '#db2777'),
          color: '#fff', fontSize: '18px', fontWeight: 600, cursor: 'pointer',
          opacity: (!isConnected && !quote) || loading || swapping ? 0.5 : 1,
        }}
      >
        {!isConnected && !quote ? 'Connect Wallet' :
         loading ? 'Fetching Best Price...' :
         swapping ? 'Confirm in Wallet...' :
         !quote ? 'Get Quote' :
         `Swap ${srcToken.symbol} → ${dstToken.symbol}`}
      </button>

      {/* Settings */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button onClick={() => setShowSettings(!showSettings)} style={{
          background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '14px',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          ⚙ Slippage: {slippage}%
        </button>
      </div>
      {showSettings && (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
          {SWAP_SLIPPAGE_PRESETS.map(p => (
            <button key={p.label} onClick={() => setSlippage(p.value)} style={{
              padding: '4px 12px', borderRadius: '8px', background: slippage === p.value ? 'rgba(56,152,255,0.2)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)', color: slippage === p.value ? '#58a6ff' : '#8b949e',
              fontSize: '12px', cursor: 'pointer',
            }}>{p.label}</button>
          ))}
        </div>
      )}

      {showSrcModal && (
        <TokenModal tokens={SWAP_TOKENS} selected={srcToken} title="Select token"
          onSelect={t => { setSrcToken(t); setShowSrcModal(false); setQuote(null); }}
          onClose={() => setShowSrcModal(false)} />
      )}
      {showDstModal && (
        <TokenModal tokens={SWAP_TOKENS} selected={dstToken} title="Select token"
          onSelect={t => { setDstToken(t); setShowDstModal(false); setQuote(null); }}
          onClose={() => setShowDstModal(false)} />
      )}
    </div>
  );
}
