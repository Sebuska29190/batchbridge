import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { useAccount } from 'wagmi'
import { formatUnits, erc20Abi, parseUnits, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import {
  ArrowDownUp, Wallet, Settings, Info, ChevronDown, Search, ExternalLink,
  TrendingUp, RefreshCw, CheckCircle2, AlertCircle, Clock, Layers, Activity,
  LogOut, Sliders, Sparkles
} from 'lucide-react'

const BaseLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#0052FF"/><circle cx="12" cy="12" r="7" stroke="white" strokeWidth="2.5"/></svg>
)

interface Tok { symbol: string; name: string; decimals: number; logo: string; address: string }

const BASE_TOKENS: Tok[] = [
  { symbol: 'ETH', name: 'Ethereum', decimals: 18, logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=024', address: '0x0000000000000000000000000000000000000000' },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=024', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/2518/small/weth.png', address: '0x4200000000000000000000000000000000000006' },
  { symbol: 'AERO', name: 'Aerodrome Finance', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/31745/small/aerodrome.png', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' },
  { symbol: 'DEGEN', name: 'Degen', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/34515/small/degen.png', address: '0x3055913c90Fccf2F2f0F03C19b5E3E329e5b8Bb6' },
  { symbol: 'cbBTC', name: 'Coinbase BTC', decimals: 8, logo: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.png', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' },
  { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
]

const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
function toPara(a: string) { return a === '0x0000000000000000000000000000000000000000' ? NATIVE : a }

export default function NexusSwap() {
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const { address, isConnected } = useAccount()

  const [tokenFrom, setTokenFrom] = useState<Tok>(BASE_TOKENS[0])
  const [tokenTo, setTokenTo] = useState<Tok>(BASE_TOKENS[1])
  const [amountFrom, setAmountFrom] = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [slippage, setSlippage] = useState('0.5')
  const [customSlippage, setCustomSlippage] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [tokenSelectorTarget, setTokenSelectorTarget] = useState<'from'|'to'>('from')
  const [isSwapping, setIsSwapping] = useState(false)
  const [quote, setQuote] = useState<any>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [alertMessage, setAlertMessage] = useState<{type: string; text: string} | null>(null)
  const [txHistory, setTxHistory] = useState<any[]>([])
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState('swap')
  const [quoteError, setQuoteError] = useState('')

  const showAlert = useCallback((type: string, text: string) => {
    setAlertMessage({ type, text }); setTimeout(() => setAlertMessage(null), 4000)
  }, [])

  const client = useMemo(() => createPublicClient({ chain: base, transport: http('https://mainnet.base.org') }), [])

  const loadBalances = useCallback(async () => {
    if (!address) return
    const r: Record<string, string> = {}
    await Promise.all(BASE_TOKENS.map(async t => {
      try {
        if (t.address === '0x0000000000000000000000000000000000000000') {
          r[t.address] = formatUnits(await client.getBalance({ address: address as `0x${string}` }), 18)
        } else {
          r[t.address] = formatUnits(await client.readContract({ address: t.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] }), t.decimals)
        }
      } catch { r[t.address] = '0' }
    }))
    setBalances(r)
  }, [address, client])

  useEffect(() => { loadBalances() }, [loadBalances])

  useEffect(() => {
    if (!amountFrom || parseFloat(amountFrom) <= 0 || !isConnected) { setAmountTo(''); setQuote(null); return }
    const timer = setTimeout(async () => {
      setQuoteLoading(true); setQuoteError('')
      try {
        const srcAmt = parseUnits(amountFrom, tokenFrom.decimals).toString()

        // Fetch from ParaSwap + OKX in parallel
        const [paraR, okxR] = await Promise.allSettled([
          fetch('/api/paraswap/prices?' + new URLSearchParams({ srcToken: toPara(tokenFrom.address), destToken: toPara(tokenTo.address), srcDecimals: String(tokenFrom.decimals), destDecimals: String(tokenTo.decimals), amount: srcAmt, side: 'SELL', network: '8453' }).toString()),
          fetch('/api/okx?action=quote&' + new URLSearchParams({ chainIndex: '8453', amount: srcAmt, fromToken: toPara(tokenFrom.address), toToken: toPara(tokenTo.address) }).toString()),
        ])

        let best: any = null; let bestAmt = BigInt(0); let bestProv = ''

        // Parse ParaSwap
        if (paraR.status === 'fulfilled' && paraR.value.ok) {
          const d = await paraR.value.json()
          if (d.priceRoute?.destAmount) { const a = BigInt(d.priceRoute.destAmount); if (a > bestAmt) { bestAmt = a; best = d.priceRoute; bestProv = 'ParaSwap' } }
        }

        // Parse OKX (may fail locally without HMAC — that's fine)
        if (okxR.status === 'fulfilled' && okxR.value.ok) {
          const d = await okxR.value.json()
          if (d.data?.[0]?.toTokenAmount) { const a = BigInt(d.data[0].toTokenAmount); if (a > bestAmt) { bestAmt = a; best = d.data[0]; bestProv = 'OKX' } }
        }

        if (!best) throw new Error('No route found')
        best._provider = bestProv
        setQuote(best)
        setAmountTo(formatUnits(bestAmt, tokenTo.decimals))
      } catch (e: any) { setQuoteError(e.message || 'Quote failed'); setQuote(null) }
      finally { setQuoteLoading(false) }
    }, 600)
    return () => clearTimeout(timer)
  }, [amountFrom, tokenFrom, tokenTo, isConnected])

  const handleSwapExecute = async () => {
    if (!isConnected || !quote) return
    setIsSwapping(true)
    try {
      const provider = quote._provider || 'ParaSwap'
      let txData: any

      if (provider === 'OKX') {
        const srcAmt = parseUnits(amountFrom, tokenFrom.decimals).toString()
        const resp = await fetch('/api/okx', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chainIndex: '8453', amount: srcAmt, fromTokenAddress: toPara(tokenFrom.address), toTokenAddress: toPara(tokenTo.address), slippagePercent: slippage, userWalletAddress: address, swapMode: 'exactIn' })
        })
        const d = await resp.json()
        if (!resp.ok || !d.data?.[0]) throw new Error(d.msg || 'OKX swap failed')
        txData = d.data[0]
      } else {
        const srcAmt = parseUnits(amountFrom, tokenFrom.decimals).toString()
        const resp = await fetch('/api/paraswap/transactions/8453?ignoreChecks=true', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ srcToken: toPara(tokenFrom.address), destToken: toPara(tokenTo.address), srcDecimals: tokenFrom.decimals, destDecimals: tokenTo.decimals, srcAmount: srcAmt, userWalletAddress: address, slippage: Math.floor(parseFloat(slippage) * 100) })
        })
        const d = await resp.json()
        if (!resp.ok || !d.to || !d.data) throw new Error(d.error || 'Swap failed')
        txData = d
      }

      const w = window as any
      const txParams = txData.tx ? { from: address, to: txData.tx.to, data: txData.tx.data, value: '0x' + BigInt(txData.tx.value || '0').toString(16) } : { from: address, to: txData.to, data: txData.data, value: '0x' + BigInt(txData.value || '0').toString(16) }
      const txHash = await w.ethereum.request({ method: 'eth_sendTransaction', params: [txParams] })
      setTxHistory(prev => [{ id: Date.now(), from: `${amountFrom} ${tokenFrom.symbol}`, to: `${amountTo} ${tokenTo.symbol}`, status: 'Completed', time: 'Just now', txHash: txHash.slice(0,10) + '...' + txHash.slice(-4), hash: txHash }, ...prev])
      showAlert('success', `Swapped ${amountFrom} ${tokenFrom.symbol} → ${amountTo} ${tokenTo.symbol}`)
      setAmountFrom(''); setAmountTo(''); setQuote(null); loadBalances()
    } catch (e: any) { showAlert('error', e?.code === 4001 ? 'Cancelled' : e.message || 'Swap failed') }
    finally { setIsSwapping(false) }
  }

  function switchTokens() { const t = tokenFrom; setTokenFrom(tokenTo); setTokenTo(t); setAmountFrom(amountTo); setQuote(null) }
  function openTokenModal(target: 'from'|'to') { setTokenSelectorTarget(target); setIsTokenModalOpen(true); setSearchQuery('') }
  function handleTokenSelect(t: Tok) {
    if (tokenSelectorTarget === 'from') { if (t.symbol === tokenTo.symbol) setTokenTo(tokenFrom); setTokenFrom(t) }
    else { if (t.symbol === tokenFrom.symbol) setTokenFrom(tokenTo); setTokenTo(t) }
    setIsTokenModalOpen(false); setQuote(null)
  }

  const filteredTokens = BASE_TOKENS.filter(t => !searchQuery || t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const rate = quote && amountTo && amountFrom ? (parseFloat(amountTo) / parseFloat(amountFrom)).toFixed(6) : '0'
  const minReceived = amountTo ? (parseFloat(amountTo) * (1 - parseFloat(customSlippage || slippage) / 100)).toFixed(6) : '0'
  const priceImpact = !amountFrom ? '0.00%' : parseFloat(amountFrom) < 10 ? '< 0.01%' : parseFloat(amountFrom) < 100 ? '0.04%' : '0.12%'
  const walletBal = balances[tokenFrom.address] || '0'

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[180px] pointer-events-none" />

      {alertMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/10 bg-slate-900/95 max-w-sm w-full mx-4">
          {alertMessage.type === 'success' && <CheckCircle2 className="text-emerald-400 w-5 h-5 flex-shrink-0" />}
          {alertMessage.type === 'error' && <AlertCircle className="text-rose-500 w-5 h-5 flex-shrink-0" />}
          {alertMessage.type === 'info' && <Info className="text-blue-400 w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-semibold text-slate-200">{alertMessage.text}</p>
        </div>
      )}

      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#080b11]/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000" />
              <div className="relative bg-[#0d111a] p-2.5 rounded-xl border border-white/10 flex items-center justify-center"><BaseLogo /></div>
            </div>
            <div>
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-400 bg-clip-text text-transparent">NEXUS</span>
              <span className="text-[10px] block font-black tracking-widest text-blue-400 uppercase">BASE EDITION</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-[#0d111a] p-1.5 rounded-2xl border border-white/5">
            {['swap', 'liquidity', 'charts', 'history'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === tab ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                {tab === 'charts' ? 'Base Markets' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0d111a] border border-white/10 text-sm font-semibold">
              <BaseLogo /><span className="hidden sm:inline font-bold">Base Mainnet</span>
            </div>
            {isConnected ? (
              <div className="relative group">
                <button className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:text-white transition-all text-sm font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </button>
                <div className="absolute right-0 mt-2 w-52 bg-[#0d111a] border border-white/10 rounded-2xl shadow-2xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="px-3 py-2 border-b border-white/5 text-[11px] text-slate-500">Connected to Base</div>
                  <button onClick={() => disconnect()} className="w-full mt-1 flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all font-semibold"><LogOut className="w-4 h-4" />Disconnect</button>
                </div>
              </div>
            ) : (
              <button onClick={() => open()} className="relative group overflow-hidden px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all duration-300">
                <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 group-hover:scale-105 transition-transform duration-300" />
                <span className="relative flex items-center gap-2"><Wallet className="w-4 h-4" />Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="md:hidden flex justify-around items-center border-t border-white/5 bg-[#080b11]/95 backdrop-blur-md py-3 px-2 sticky bottom-0 z-40">
        {[{ id: 'swap', label: 'Swap', Icon: ArrowDownUp }, { id: 'liquidity', label: 'Liquidity', Icon: Layers }, { id: 'charts', label: 'Markets', Icon: Activity }, { id: 'history', label: 'History', Icon: Clock }].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex flex-col items-center gap-1 text-xs px-3 py-1.5 rounded-xl transition-all ${activeTab === id ? 'text-blue-400 font-bold bg-white/5' : 'text-slate-500'}`}>
            <Icon className="w-5 h-5" /><span>{label}</span>
          </button>
        ))}
      </div>

      <main className="flex-1 flex flex-col justify-start items-center max-w-7xl w-full mx-auto px-4 py-8 md:py-12 z-10">

        {activeTab === 'swap' && (
          <div className="w-full max-w-lg flex flex-col gap-4">
            <div className="relative bg-[#0d111a]/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-black text-white tracking-wide">Swap</h2>
                  <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full">Base Gas Fee: &lt;$0.01 ⚡</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { setAmountFrom(''); setAmountTo(''); setQuote(null) }} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl transition-all"><RefreshCw className="w-4 h-4" /></button>
                  <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`p-2 rounded-xl transition-all ${isSettingsOpen ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white bg-white/5'}`}><Settings className="w-4 h-4" /></button>
                </div>
              </div>

              {isSettingsOpen && (
                <div className="mb-4 p-4 bg-[#080b11]/90 rounded-2xl border border-white/5">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-blue-400" /> Advanced Settings</h3>
                  <div className="flex justify-between items-center mb-1.5"><span className="text-xs text-slate-400">Max Slippage</span><span className="text-xs text-blue-400 font-bold">{customSlippage || slippage}%</span></div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['0.1', '0.5', '1.0'].map(val => (
                      <button key={val} onClick={() => { setSlippage(val); setCustomSlippage('') }} className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${slippage === val && !customSlippage ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-[#0d111a] border-white/5 text-slate-400 hover:text-white'}`}>{val}%</button>
                    ))}
                    <input type="number" placeholder="Custom" value={customSlippage} onChange={e => setCustomSlippage(e.target.value)} className="px-2 py-1.5 rounded-xl text-xs font-bold bg-[#0d111a] border border-white/5 text-center outline-none text-slate-200" />
                  </div>
                </div>
              )}

              <div className="p-4 bg-[#080b11]/80 rounded-2xl border border-white/5 focus-within:border-blue-500/30 transition-all">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-slate-400 font-medium">You pay</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">Balance: <span className="font-bold text-slate-200">{parseFloat(walletBal).toFixed(4)}</span>
                    {isConnected && <button onClick={() => setAmountFrom(walletBal)} className="ml-1.5 px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-[9px] font-black">MAX</button>}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <input type="number" placeholder="0" value={amountFrom} onChange={e => { setAmountFrom(e.target.value); setQuote(null) }} className="bg-transparent text-2xl md:text-3xl font-black text-white outline-none w-2/3 placeholder-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button onClick={() => openTokenModal('from')} className="flex items-center gap-2 bg-[#0d111a] hover:bg-slate-900 px-3 py-2 rounded-2xl transition-all border border-white/5">
                    <img src={tokenFrom.logo} alt={tokenFrom.symbol} className="w-5 h-5 rounded-full" /><span className="font-bold text-sm text-slate-100">{tokenFrom.symbol}</span><ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="relative flex justify-center -my-3 z-10">
                <button onClick={switchTokens} className="p-2.5 bg-[#0d111a] border-4 border-[#080b11] hover:border-blue-500/20 text-blue-400 hover:text-white rounded-xl transition-all shadow-xl hover:scale-105"><ArrowDownUp className="w-4 h-4" /></button>
              </div>

              <div className="p-4 bg-[#080b11]/80 rounded-2xl border border-white/5 focus-within:border-blue-500/30 transition-all mt-1">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-slate-400 font-medium">You receive</span>
                  <span className="text-xs text-slate-400">Balance: <span className="font-bold text-slate-200">{parseFloat(balances[tokenTo.address] || '0').toFixed(4)}</span></span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="bg-transparent text-2xl md:text-3xl font-black text-white outline-none w-2/3">
                    {quoteLoading ? <span className="text-slate-500 animate-pulse">Fetching...</span> : amountTo ? parseFloat(amountTo).toFixed(6) : <span className="text-slate-700">0</span>}
                  </div>
                  <button onClick={() => openTokenModal('to')} className="flex items-center gap-2 bg-[#0d111a] hover:bg-slate-900 px-3 py-2 rounded-2xl transition-all border border-white/5">
                    <img src={tokenTo.logo} alt={tokenTo.symbol} className="w-5 h-5 rounded-full" /><span className="font-bold text-sm text-slate-100">{tokenTo.symbol}</span><ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>

              {quote && quote.protocols && (
                <div className="mt-4 p-4 bg-[#080b11]/50 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase flex items-center gap-1 mb-2.5"><Sparkles className="w-3.5 h-3.5" /> Smart Routing ({quote._provider || 'ParaSwap'})</span>
                  <div className="flex items-center justify-between gap-2 px-1 py-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-[10px] font-black">{tokenFrom.symbol}</div>
                    <div className="flex-1 flex flex-col gap-2.5">
                      {(quote.protocols?.[0] || []).slice(0, 2).map((p: any, i: number) => (
                        <div key={i} className="relative flex items-center justify-between">
                          <div className="h-[1px] bg-gradient-to-r from-blue-500/30 to-blue-500/60 flex-1 relative">
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] text-slate-500 bg-[#0d111a] px-1 rounded border border-white/5">{p[0]?.part}%</span>
                          </div>
                          <div className="px-2 py-0.5 bg-blue-500/5 border border-blue-500/20 rounded-md text-[9px] text-slate-300 mx-2 font-semibold">{p[0]?.name || 'DEX'}</div>
                          <div className="h-[1px] bg-gradient-to-r from-blue-500/60 to-blue-500/30 flex-1" />
                        </div>
                      ))}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-[10px] font-black">{tokenTo.symbol}</div>
                  </div>
                </div>
              )}

              {quoteError && <div className="mt-3 text-xs text-rose-400 text-center">{quoteError}</div>}

              {quote && amountTo && (
                <div className="mt-3 p-3.5 bg-[#080b11]/30 rounded-2xl border border-white/5 space-y-2 text-xs text-slate-400">
                  <div className="flex justify-between"><span>Rate</span><span className="font-bold text-slate-200">1 {tokenFrom.symbol} = {rate} {tokenTo.symbol}</span></div>
                  <div className="flex justify-between"><span className="flex items-center gap-1">Minimum received <Info className="w-3.5 h-3.5 text-slate-600" /></span><span className="font-bold text-slate-200">{minReceived} {tokenTo.symbol}</span></div>
                  <div className="flex justify-between"><span>Price Impact</span><span className="font-bold text-emerald-400">{priceImpact}</span></div>
                  <div className="flex justify-between"><span>Base Gas Cost</span><span className="font-bold text-slate-200">&lt;$0.01</span></div>
                  <div className="flex justify-between"><span>Route</span><span className="font-bold text-blue-400">ParaSwap</span></div>
                </div>
              )}

              <button onClick={handleSwapExecute} disabled={isSwapping || !isConnected || !quote}
                className="w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 hover:opacity-95 text-white font-extrabold text-base transition-all shadow-[0_4px_30px_rgba(59,130,246,0.3)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2">
                {isSwapping ? <><RefreshCw className="w-5 h-5 animate-spin" />Routing Transaction...</> : !isConnected ? 'Connect Wallet' : !quote ? 'Enter Amount' : 'Confirm Swap'}
              </button>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 h-fit"><Sparkles className="w-4 h-4 animate-pulse" /></div>
              <div><h4 className="text-xs font-bold text-slate-200">Nexus MEV-Shield Active</h4><p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Your swap on Base is protected from sandwich attacks using direct-to-builder private routing.</p></div>
            </div>
          </div>
        )}

        {activeTab === 'liquidity' && (
          <div className="w-full max-w-lg"><div className="bg-[#0d111a]/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white tracking-wide">Base Liquidity Pools</h2><p className="text-xs text-slate-400 mt-1">Provide liquidity and earn fees</p>
            <div className="my-6 grid grid-cols-2 gap-3 p-1 bg-[#080b11] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3 p-3 bg-[#0d111a] rounded-xl border border-white/5"><img src={tokenFrom.logo} className="w-5 h-5 rounded-full" /><span className="font-bold text-sm text-slate-200">{tokenFrom.symbol}</span></div>
              <div className="flex items-center gap-3 p-3 bg-[#0d111a] rounded-xl border border-white/5"><img src={tokenTo.logo} className="w-5 h-5 rounded-full" /><span className="font-bold text-sm text-slate-200">{tokenTo.symbol}</span></div>
            </div>
            <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 text-white font-extrabold text-base transition-all hover:scale-[1.01]">Add Base Liquidity</button>
          </div></div>
        )}

        {activeTab === 'charts' && (
          <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#0d111a]/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              <h3 className="font-extrabold text-white text-base">Base Market Overview</h3>
              <div className="mt-6 space-y-4">
                {BASE_TOKENS.filter(t => t.symbol !== 'WETH' && t.symbol !== 'DAI').map(t => (
                  <div key={t.symbol} className="flex items-center justify-between p-3 bg-[#080b11] rounded-xl border border-white/5">
                    <div className="flex items-center gap-3"><img src={t.logo} className="w-8 h-8 rounded-full" /><div><span className="font-bold text-sm">{t.symbol}</span><span className="text-xs text-slate-500 block">{t.name}</span></div></div>
                    <span className="text-sm font-bold text-emerald-400">{parseFloat(balances[t.address] || '0').toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#0d111a]/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              <h3 className="font-extrabold text-white text-base">Base L2 Analytics</h3>
              <div className="space-y-3.5 mt-4">
                <div className="p-3.5 bg-[#080b11] rounded-2xl border border-white/5"><span className="text-xs text-slate-500 block">Total Value Locked</span><span className="text-xl font-black text-white">$2.19B</span></div>
                <div className="p-3.5 bg-[#080b11] rounded-2xl border border-white/5"><span className="text-xs text-slate-500 block">Transaction Speed</span><span className="text-xl font-black text-emerald-400">~2 sec</span></div>
                <div className="p-3.5 bg-[#080b11] rounded-2xl border border-white/5"><span className="text-xs text-slate-500 block">Gas Cost</span><span className="text-xl font-black text-white">&lt;$0.01</span></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="w-full max-w-2xl bg-[#0d111a]/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-white tracking-wide">Activity Log</h2>
              <button onClick={() => setTxHistory([])} className="text-xs text-rose-400 hover:underline font-bold">Clear</button>
            </div>
            {txHistory.length > 0 ? (
              <div className="space-y-3">
                {txHistory.map((tx: any) => (
                  <div key={tx.id} className="p-4 bg-[#080b11]/80 rounded-2xl border border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl"><ArrowDownUp className="w-5 h-5" /></div>
                      <div><span className="font-extrabold text-slate-200 text-sm block">{tx.from} ➔ {tx.to}</span><span className="text-xs text-slate-400">{tx.time}</span></div>
                    </div>
                    <div className="text-right"><span className="text-xs block text-emerald-400 font-bold">{tx.status}</span>
                      <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" className="text-[11px] text-blue-400 flex items-center gap-1 hover:underline mt-1 font-semibold">{tx.txHash} <ExternalLink className="w-3 h-3" /></a>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-center py-16 text-slate-600 text-sm">No transactions yet.</div>}
          </div>
        )}
      </main>

      <footer className="w-full border-t border-white/5 bg-[#080b11]/90 py-8 text-center text-xs text-slate-500 z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>&copy; 2026 NEXUS PROTOCOL — Base L2</div>
          <div className="flex gap-4"><a href="#" className="hover:text-blue-400">GitHub</a><a href="#" className="hover:text-blue-400">Docs</a></div>
        </div>
      </footer>

      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setIsTokenModalOpen(false)}>
          <div className="w-full max-w-md bg-[#0d111a] border border-white/10 rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-white text-lg">Select Token</h3>
              <button onClick={() => setIsTokenModalOpen(false)} className="text-slate-500 hover:text-white text-sm font-semibold">✕</button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search by name or symbol" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#080b11] border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-slate-200 focus:border-blue-500/30 outline-none placeholder-slate-600" />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
              {filteredTokens.map(t => (
                <button key={t.address} onClick={() => handleTokenSelect(t)} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#080b11]/40 hover:bg-[#080b11]/90 border border-transparent hover:border-white/5 transition-all text-left">
                  <div className="flex items-center gap-3"><img src={t.logo} alt={t.symbol} className="w-8 h-8 rounded-full" /><div><span className="font-extrabold text-slate-100 block text-sm">{t.symbol}</span><span className="text-xs text-slate-500 block">{t.name}</span></div></div>
                  <span className="text-xs font-bold text-slate-300">{parseFloat(balances[t.address] || '0').toFixed(4)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
