import { useState, useEffect, useCallback, useRef } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { useAccount, useChainId, useSendTransaction, useSwitchChain } from 'wagmi'
import { formatUnits, parseUnits, createPublicClient, http, erc20Abi } from 'viem'
import { CHAINS, COMMON_TOKENS } from './wagmi'

const PARASWAP_API = '/api/paraswap'
const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const isNative = (a: string) => a === '0x0000000000000000000000000000000000000000'
const toPara = (a: string) => isNative(a) ? NATIVE : a

const RPCS: Record<number, string> = {
  1: 'https://rpc.ankr.com/eth', 8453: 'https://mainnet.base.org',
  42161: 'https://arb1.arbitrum.io/rpc', 10: 'https://mainnet.optimism.io',
  137: 'https://polygon-rpc.com',
}

export default function App() {
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { sendTransactionAsync } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()

  const chain = CHAINS.find(c => c.id === chainId) || CHAINS[1]
  const tokens = COMMON_TOKENS[chainId] || COMMON_TOKENS[8453]

  const [srcToken, setSrcToken] = useState(tokens[0])
  const [dstToken, setDstToken] = useState(tokens[1])
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState('0.5')
  const [showSettings, setShowSettings] = useState(false)
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [quote, setQuote] = useState<any>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState('')
  const [showTokenModal, setShowTokenModal] = useState<'from' | 'to' | null>(null)
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const t = COMMON_TOKENS[chainId] || COMMON_TOKENS[8453]
    setSrcToken(t[0]); setDstToken(t[1]); setQuote(null); setAmount(''); setError(''); setTxHash('')
  }, [chainId])

  const loadBalances = useCallback(async () => {
    if (!address || !tokens.length) return
    const client = createPublicClient({ chain: { id: chainId } as any, transport: http(RPCS[chainId] || RPCS[8453]) })
    const r: Record<string, string> = {}
    await Promise.all(tokens.map(async t => {
      try {
        if (isNative(t.address)) r[t.address] = formatUnits(await client.getBalance({ address: address as `0x${string}` }), 18)
        else r[t.address] = formatUnits(await client.readContract({ address: t.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] }), t.decimals)
      } catch { r[t.address] = '0' }
    }))
    setBalances(r)
  }, [address, tokens, chainId])

  useEffect(() => { if (isConnected && address) loadBalances() }, [isConnected, address, chainId, loadBalances])

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !isConnected || !srcToken || !dstToken) { setQuote(null); return }
    if (srcToken.address === dstToken.address) { setError('Cannot swap same token'); setQuote(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setQuoteLoading(true); setError('')
      try {
        const srcAmt = parseUnits(amount, srcToken.decimals).toString()
        const resp = await fetch(`${PARASWAP_API}/prices?` + new URLSearchParams({
          srcToken: toPara(srcToken.address), destToken: toPara(dstToken.address),
          srcDecimals: String(srcToken.decimals), destDecimals: String(dstToken.decimals),
          amount: srcAmt, side: 'SELL', network: String(chainId),
        }))
        if (!resp.ok) throw new Error('No route found')
        const data = await resp.json()
        if (!data.priceRoute?.destAmount) throw new Error('No route found')
        setQuote({ ...data.priceRoute, provider: 'ParaSwap' })
      } catch (e: any) { setError(e.message || 'Quote failed'); setQuote(null) }
      finally { setQuoteLoading(false) }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [amount, srcToken, dstToken, chainId, isConnected])

  const switchTokens = () => { setSrcToken(dstToken); setDstToken(srcToken); setQuote(null); setAmount(quote ? formatUnits(BigInt(quote.destAmount), dstToken.decimals) : '') }

  const handleSwap = async () => {
    if (!isConnected || !quote || !address) return
    setIsSwapping(true); setError(''); setTxHash('')
    try {
      const srcAmt = parseUnits(amount, srcToken.decimals).toString()
      const resp = await fetch(`${PARASWAP_API}/transactions/${chainId}?ignoreChecks=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srcToken: toPara(srcToken.address), destToken: toPara(dstToken.address),
          srcDecimals: srcToken.decimals, destDecimals: dstToken.decimals,
          srcAmount: srcAmt, userAddress: address, slippage: Math.floor(parseFloat(slippage) * 100),
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.to || !data.data) throw new Error(data.error || 'Swap failed')
      const hash = await sendTransactionAsync({ to: data.to as `0x${string}`, data: data.data as `0x${string}`, value: BigInt(data.value || '0') })
      setTxHash(hash); setAmount(''); setQuote(null); loadBalances()
    } catch (e: any) {
      if (e?.code === 4001) setError('Transaction cancelled')
      else setError(e?.shortMessage || e?.message || 'Swap failed')
    } finally { setIsSwapping(false) }
  }

  const walletBal = balances[srcToken?.address || ''] || '0'
  const dstAmount = quote ? formatUnits(BigInt(quote.destAmount), dstToken.decimals) : '0'
  const rate = quote && amount && parseFloat(amount) > 0 ? (parseFloat(dstAmount) / parseFloat(amount)).toFixed(6) : null

  const filteredTokens = (showTokenModal === 'from' ? tokens : tokens).filter(t =>
    !search || t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="app">
      {/* Token Modal */}
      {showTokenModal && (
        <div className="modal-overlay" onClick={() => { setShowTokenModal(null); setSearch('') }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Token</h3>
              <button className="modal-close" onClick={() => { setShowTokenModal(null); setSearch('') }}>×</button>
            </div>
            <div className="modal-search">
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            </div>
            <div className="modal-list">
              {filteredTokens.map(t => (
                <button key={t.address} className="modal-item" onClick={() => {
                  if (showTokenModal === 'from') { if (t.symbol === dstToken.symbol) setDstToken(srcToken); setSrcToken(t) }
                  else { if (t.symbol === srcToken.symbol) setSrcToken(dstToken); setDstToken(t) }
                  setShowTokenModal(null); setSearch(''); setQuote(null)
                }}>
                  <img src={t.logo} alt={t.symbol} className="token-icon" />
                  <div><span className="token-symbol">{t.symbol}</span><span className="token-name">{t.name}</span></div>
                  <span className="token-bal">{parseFloat(balances[t.address] || '0').toFixed(4)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </div>
          <span className="logo-text">Batch<span className="logo-accent">Bridge</span></span>
        </div>
        <div className="header-actions">
          <div className="chain-badge">
            <img src={chain.logo} alt={chain.name} className="chain-icon" />
            <span>{chain.name}</span>
          </div>
          {isConnected ? (
            <button className="btn-account" onClick={() => disconnect()}>
              <span className="dot" />{address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button className="btn-connect" onClick={() => open()}>Connect Wallet</button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="main">
        <div className="swap-card">
          <div className="swap-header">
            <h2>Swap</h2>
            <button className={`icon-btn ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(!showSettings)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
            </button>
          </div>

          {showSettings && (
            <div className="settings">
              <span className="settings-label">Slippage</span>
              <div className="slippage-btns">
                {['0.1', '0.5', '1.0'].map(v => (
                  <button key={v} className={`slip-btn ${slippage === v ? 'active' : ''}`} onClick={() => setSlippage(v)}>{v}%</button>
                ))}
                <input type="number" placeholder="Custom" value={slippage} onChange={e => setSlippage(e.target.value)} className="slip-input" />
              </div>
            </div>
          )}

          <div className="input-box">
            <div className="input-header"><span>You pay</span>{isConnected && <span className="bal">Balance: {parseFloat(walletBal).toFixed(4)} <button className="max-btn" onClick={() => setAmount(walletBal)}>MAX</button></span>}</div>
            <div className="input-row">
              <input type="number" placeholder="0" value={amount} onChange={e => { setAmount(e.target.value); setQuote(null); setError('') }} className="amount-input" />
              <button className="token-btn" onClick={() => setShowTokenModal('from')}>
                <img src={srcToken.logo} alt={srcToken.symbol} className="token-icon" />
                <span>{srcToken.symbol}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
            </div>
            {amount && parseFloat(amount) > parseFloat(walletBal) && <div className="insufficient">Insufficient balance</div>}
          </div>

          <div className="arrow-row"><button className="arrow-btn" onClick={switchTokens}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg></button></div>

          <div className="input-box">
            <div className="input-header"><span>You receive</span>{isConnected && <span className="bal">Balance: {parseFloat(balances[dstToken.address] || '0').toFixed(4)}</span>}</div>
            <div className="input-row">
              <div className="amount-display">{quoteLoading ? <span className="fetching">Fetching...</span> : quote ? parseFloat(dstAmount).toFixed(6) : <span className="zero">0</span>}</div>
              <button className="token-btn" onClick={() => setShowTokenModal('to')}>
                <img src={dstToken.logo} alt={dstToken.symbol} className="token-icon" />
                <span>{dstToken.symbol}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          {txHash && <div className="tx-link"><a href={`${chain.explorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer">View on Explorer ↗</a></div>}

          {quote && !quoteLoading && (
            <div className="quote-info">
              <div className="quote-row"><span>Rate</span><span>1 {srcToken.symbol} ≈ {rate} {dstToken.symbol}</span></div>
              <div className="quote-row"><span>Minimum received</span><span>{(parseFloat(dstAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {dstToken.symbol}</span></div>
              <div className="quote-row"><span>Route</span><span className="accent">ParaSwap</span></div>
            </div>
          )}

          <button className="execute-btn" onClick={quote ? handleSwap : undefined}
            disabled={!isConnected || !quote || quoteLoading || isSwapping || (parseFloat(amount) > parseFloat(walletBal))}>
            {!isConnected ? 'Connect Wallet' : quoteLoading ? 'Getting Quote...' : isSwapping ? 'Confirm in Wallet...' : !quote ? (amount ? 'No Route' : 'Enter Amount') : `Swap ${srcToken.symbol} → ${dstToken.symbol}`}
          </button>
        </div>
      </main>

      <footer className="footer">© 2025 BatchBridge.xyz — Multi-Chain Swap & Bridge · Non-custodial · Powered by ParaSwap</footer>

      <SpeedInsights />
      <Analytics />
    </div>
  )
}
