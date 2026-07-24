import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useChainId, useSendTransaction } from 'wagmi'
import { formatUnits, erc20Abi } from 'viem'
import { COMMON_TOKENS, getChainById } from '../config/chains'
import { getPublicClientWithFallback } from '../services/prices'
import { getBestQuote, getSwapTx } from '../services/aggregator'
import type { Token } from '../types'
import type { AggregatorResult } from '../services/aggregator'

const isNative = (addr: string) => addr === '0x0000000000000000000000000000000000000000'

export function useSwap() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { sendTransactionAsync } = useSendTransaction()

  const tokens = COMMON_TOKENS[chainId] || COMMON_TOKENS[8453]
  const chainInfo = getChainById(chainId)

  const [srcToken, setSrcToken] = useState<Token | null>(tokens[0] || null)
  const [dstToken, setDstToken] = useState<Token | null>(tokens[1] || null)
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [customSlippage, setCustomSlippage] = useState('')

  const [bestQuote, setBestQuote] = useState<AggregatorResult | null>(null)
  const [allQuotes, setAllQuotes] = useState<AggregatorResult[]>([])
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState('')
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [balancesLoading, setBalancesLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const newTokens = COMMON_TOKENS[chainId] || COMMON_TOKENS[8453]
    setSrcToken(newTokens[0] || null)
    setDstToken(newTokens[1] || null)
    setBestQuote(null)
    setAllQuotes([])
    setAmount('')
    setError('')
    setTxHash('')
    setBalances({})
  }, [chainId])

  const loadBalances = useCallback(async () => {
    if (!address || !tokens.length || !isConnected) return
    setBalancesLoading(true)
    try {
      const client = await getPublicClientWithFallback(chainId)
      const results: Record<string, string> = {}
      await Promise.all(tokens.map(async t => {
        try {
          if (isNative(t.address)) {
            const bal = await client.getBalance({ address: address as `0x${string}` })
            results[t.address] = formatUnits(bal, 18)
          } else {
            const bal = await client.readContract({
              address: t.address as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            })
            results[t.address] = formatUnits(bal, t.decimals)
          }
        } catch (e) {
          console.warn(`[useSwap] Balance fetch failed for ${t.symbol}:`, e)
          results[t.address] = '0'
        }
      }))
      setBalances(results)
    } catch (e) {
      console.error('[useSwap] loadBalances failed completely:', e)
    } finally {
      setBalancesLoading(false)
    }
  }, [address, tokens, chainId, isConnected])

  useEffect(() => {
    if (isConnected && address) loadBalances()
  }, [isConnected, address, chainId, loadBalances])

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !isConnected || !srcToken || !dstToken || !address) {
      setBestQuote(null)
      setAllQuotes([])
      return
    }
    if (srcToken.address === dstToken.address) {
      setError('Cannot swap same token')
      setBestQuote(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setQuoteLoading(true)
      setError('')
      try {
        const result = await getBestQuote({
          srcToken, dstToken, amount, chainId, slippage, userAddress: address,
        })
        if (!result) {
          setError('No route found for this pair')
          setBestQuote(null)
          setAllQuotes([])
        } else {
          setBestQuote(result.best)
          setAllQuotes(result.all)
        }
      } catch (e: any) {
        setError(e.message || 'Quote failed')
        setBestQuote(null)
        setAllQuotes([])
      } finally {
        setQuoteLoading(false)
      }
    }, 500)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [amount, srcToken, dstToken, chainId, slippage, isConnected, address])

  const switchTokens = useCallback(() => {
    setSrcToken(dstToken)
    setDstToken(srcToken)
    if (bestQuote) setAmount(bestQuote.dstAmountFormatted)
    setBestQuote(null)
    setAllQuotes([])
    setError('')
  }, [srcToken, dstToken, bestQuote])

  const handleSwap = useCallback(async () => {
    if (!isConnected || !bestQuote || !address || !srcToken || !dstToken) return
    setIsSwapping(true)
    setError('')
    setTxHash('')
    try {
      const txData = await getSwapTx(
        { srcToken, dstToken, amount, chainId, slippage, userAddress: address },
        bestQuote.provider,
      )
      if (!txData) throw new Error('Failed to get swap transaction')
      const hash = await sendTransactionAsync({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || '0'),
      })
      setTxHash(hash)
      setAmount('')
      setBestQuote(null)
      setAllQuotes([])
      loadBalances()
    } catch (e: any) {
      if (e?.code === 4001 || e?.message?.includes('rejected')) setError('Transaction cancelled')
      else setError(e?.shortMessage || e?.message || 'Swap failed')
    } finally {
      setIsSwapping(false)
    }
  }, [isConnected, bestQuote, address, srcToken, dstToken, amount, chainId, slippage, sendTransactionAsync, loadBalances])

  const walletBal = balances[srcToken?.address || ''] || '0'

  return {
    srcToken, setSrcToken, dstToken, setDstToken,
    amount, setAmount, slippage, setSlippage,
    customSlippage, setCustomSlippage,
    bestQuote, allQuotes, quoteLoading,
    isSwapping, error, setError, txHash,
    balances, walletBal, tokens, balancesLoading,
    chainInfo, chainId, isConnected, address,
    switchTokens, handleSwap, loadBalances,
  }
}
