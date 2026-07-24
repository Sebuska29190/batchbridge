import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount, useChainId, useSwitchChain, useSendTransaction } from 'wagmi'
import { parseUnits, formatUnits, createPublicClient, http, erc20Abi } from 'viem'
import { base } from 'viem/chains'
import { COMMON_TOKENS, getChainById, CHAINS } from '../../config/chains'
import { formatUsd } from '../../services/prices'
import TokenSelector from '../shared/TokenSelector'
import SlippageControl from '../shared/SlippageControl'
import type { Token, SwapQuote } from '../../types'

const PARASWAP_API = '/api/paraswap'
const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const isNative = (addr: string) => addr === '0x0000000000000000000000000000000000000000'
const toPara = (addr: string) => isNative(addr) ? NATIVE_ETH : addr

export default function SwapCard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()

  const tokens = useMemo(() => COMMON_TOKENS[chainId] || COMMON_TOKENS[8453], [chainId])
  const chainInfo = getChainById(chainId)
  const [srcToken, setSrcToken] = useState<Token | null>(tokens[0] || null)
  const [dstToken, setDstToken] = useState<Token | null>(tokens[1] || null)
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [customSlippage, setCustomSlippage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState('')
  const [balances, setBalances] = useState<Record<string, string>>({})

  useEffect(() => {
    setSrcToken(tokens[0] || null)
    setDstToken(tokens[1] || null)
    setQuote(null)
    setAmount('')
    setError('')
    setTxHash('')
  }, [chainId])

  const loadBalances = useCallback(async () => {
    if (!address || !tokens.length) return
    const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
    const results: Record<string, string> = {}
    await Promise.all(tokens.map(async t => {
      try {
        if (isNative(t.address)) {
          results[t.address] = formatUnits(await client.getBalance({ address: address as `0x${string}` }), 18)
        } else {
          results[t.address] = formatUnits(
            await client.readContract({ address: t.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] }),
            t.decimals
          )
        }
      } catch { results[t.address] = '0' }
    }))
    setBalances(results)
  }, [address, tokens])

  useEffect(() => { loadBalances() }, [loadBalances])

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !isConnected || !srcToken || !dstToken) {
      setQuote(null)
      return
    }
    const timer = setTimeout(async () => {
      setQuoteLoading(true)
      setError('')
      try {
        const srcAmt = parseUnits(amount, srcToken.decimals).toString()
        const params = new URLSearchParams({
          srcToken: toPara(srcToken.address),
          destToken: toPara(dstToken.address),
          srcDecimals: String(srcToken.decimals),
          destDecimals: String(dstToken.decimals),
          amount: srcAmt,
          side: 'SELL',
          network: String(chainId),
        })
        const resp = await fetch(`${PARASWAP_API}/prices?${params}`)
        if (!resp.ok) throw new Error('No route found')
        const data = await resp.json()
        if (!data.priceRoute?.destAmount) throw new Error('No route found')
        setQuote({
          provider: 'ParaSwap',
          srcToken: srcToken.address,
          dstToken: dstToken.address,
          srcAmount: amount,
          dstAmount: data.priceRoute.destAmount,
          dstAmountFormatted: formatUnits(BigInt(data.priceRoute.destAmount), dstToken.decimals),
          route: [],
          gas: data.priceRoute.gasCost || '0',
          gasUsd: data.priceRoute.gasCostUSD || '0',
          priceImpact: data.priceRoute.priceImpact || '0',
        })
      } catch (e: any) {
        setError(e.message || 'Quote failed')
        setQuote(null)
      } finally {
        setQuoteLoading(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [amount, srcToken, dstToken, chainId, isConnected])

  const switchTokens = () => {
    setSrcToken(dstToken)
    setDstToken(srcToken)
    setAmount(quote ? quote.dstAmountFormatted : '')
    setQuote(null)
  }

  const handleSwap = async () => {
    if (!isConnected || !quote || !address || !srcToken || !dstToken) return
    setIsSwapping(true)
    setError('')
    setTxHash('')
    try {
      const srcAmt = parseUnits(amount, srcToken.decimals).toString()
      const resp = await fetch(`${PARASWAP_API}/transactions/${chainId}?ignoreChecks=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srcToken: toPara(srcToken.address),
          destToken: toPara(dstToken.address),
          srcDecimals: srcToken.decimals,
          destDecimals: dstToken.decimals,
          srcAmount: srcAmt,
          userAddress: address,
          slippage: Math.floor(slippage * 100),
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.to || !data.data) throw new Error(data.error || 'Swap failed')
      const hash = await sendTransactionAsync({
        to: data.to as `0x${string}`,
        data: data.data as `0x${string}`,
        value: BigInt(data.value || '0'),
      })
      setTxHash(hash)
      setAmount('')
      setQuote(null)
      loadBalances()
    } catch (e: any) {
      if (e?.code === 4001 || e?.message?.includes('rejected')) setError('Transaction cancelled')
      else setError(e?.shortMessage || e?.message || 'Swap failed')
    } finally {
      setIsSwapping(false)
    }
  }

  const walletBal = balances[srcToken?.address || ''] || '0'
  const rate = quote && amount && parseFloat(amount) > 0
    ? (parseFloat(quote.dstAmountFormatted) / parseFloat(amount)).toFixed(6)
    : null
  const minReceived = quote ? (parseFloat(quote.dstAmountFormatted) * (1 - slippage / 100)).toFixed(6) : null

  return (
    <div className="swap-card-wrapper">
      <div className="swap-card glass-card">
        <div className="swap-card-header">
          <h2>Swap</h2>
          <div className="swap-card-actions">
            <button className="swap-icon-btn" onClick={() => { setAmount(''); setQuote(null); setError('') }}>
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
          <SlippageControl value={slippage} customValue={customSlippage} onChange={setSlippage} onCustomChange={setCustomSlippage} />
        )}

        <div className="swap-input-box">
          <div className="swap-input-header">
            <span className="swap-input-label">You pay</span>
            {isConnected && (
              <span className="swap-input-balance">
                Balance: {parseFloat(walletBal).toFixed(4)}
                <button className="swap-max-btn" onClick={() => setAmount(walletBal)}>MAX</button>
              </span>
            )}
          </div>
          <div className="swap-input-row">
            <input
              type="number"
              placeholder="0"
              value={amount}
              onChange={e => { setAmount(e.target.value); setQuote(null); setError('') }}
              className="swap-amount-input"
            />
            <TokenSelector tokens={tokens} selected={srcToken} onSelect={t => { setSrcToken(t); setQuote(null) }} balances={balances} chainName={chainInfo?.name} />
          </div>
          {amount && parseFloat(amount) > parseFloat(walletBal) && (
            <div className="swap-insufficient">Insufficient balance</div>
          )}
        </div>

        <div className="swap-arrow-row">
          <button className="swap-arrow-btn" onClick={switchTokens}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
            </svg>
          </button>
        </div>

        <div className="swap-input-box">
          <div className="swap-input-header">
            <span className="swap-input-label">You receive</span>
            {dstToken && isConnected && (
              <span className="swap-input-balance">
                Balance: {parseFloat(balances[dstToken.address] || '0').toFixed(4)}
              </span>
            )}
          </div>
          <div className="swap-input-row">
            <div className="swap-amount-display">
              {quoteLoading ? (
                <span className="swap-fetching">Fetching...</span>
              ) : quote ? (
                parseFloat(quote.dstAmountFormatted).toFixed(6)
              ) : (
                <span className="swap-zero">0</span>
              )}
            </div>
            <TokenSelector tokens={tokens} selected={dstToken} onSelect={t => { setDstToken(t); setQuote(null) }} balances={balances} chainName={chainInfo?.name} />
          </div>
        </div>

        {error && <div className="swap-error">{error}</div>}

        {txHash && (
          <div className="swap-tx-link">
            <a href={`${chainInfo?.explorer || 'https://basescan.org'}/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
              View on Explorer ↗
            </a>
          </div>
        )}

        {quote && !quoteLoading && (
          <div className="swap-quote-info">
            <div className="swap-quote-row">
              <span>Rate</span>
              <span>1 {srcToken?.symbol} ≈ {rate} {dstToken?.symbol}</span>
            </div>
            {minReceived && (
              <div className="swap-quote-row">
                <span>Minimum received</span>
                <span>{minReceived} {dstToken?.symbol}</span>
              </div>
            )}
            <div className="swap-quote-row">
              <span>Price Impact</span>
              <span className={parseFloat(quote.priceImpact) > 5 ? 'text-warning' : 'text-success'}>
                {quote.priceImpact || '<0.01'}%
              </span>
            </div>
            <div className="swap-quote-row">
              <span>Route</span>
              <span className="text-accent">{quote.provider}</span>
            </div>
          </div>
        )}

        <button
          className="swap-execute-btn"
          onClick={!quote ? undefined : handleSwap}
          disabled={!isConnected || !quote || quoteLoading || isSwapping || (parseFloat(amount) > parseFloat(walletBal))}
        >
          {!isConnected ? 'Connect Wallet' :
           quoteLoading ? 'Getting Quote...' :
           isSwapping ? 'Confirm in Wallet...' :
           !quote ? (amount ? 'No Route Found' : 'Enter Amount') :
           `Swap ${srcToken?.symbol} → ${dstToken?.symbol}`}
        </button>
      </div>
    </div>
  )
}
