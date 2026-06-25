import { useState, useEffect, useRef, useCallback } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { BRIDGE_CHAINS, getChainById, COMMON_TOKENS } from '../wagmi'
import {
  fetchTokenHoldings, fetchTokenMetadata, fetchTokenBalance,
  checkRoutesAvailability, checkRouteAvailability, formatBalance,
  filterApproveStepsByAllowance, formatUsd, applyRelayPriceToToken,
  resolveExplicitDeposit, getBridgeQuote, getMultiInputQuote,
  getAggregatedSwapQuotes, detectTransferFeeToken,
  detectTransferFeeTokensBatch, pollBridgeStatus,
  submitRelaySignature, SLIPPAGE_PRESETS, MAX_PRICE_IMPACT,
  isUserRejection, RELAY_ERROR_CODES, getRelayErrorMessage,
} from '../bridgeService'

const getTokenKey = (chainId, tokenAddress) => `${Number(chainId)}:${tokenAddress.toLowerCase()}`
const MAX_BATCH_TOKENS = 10
const TRANSFER_FEE_REASON = "Transfer-fee tokens aren't supported"

export function useBridge({ address, isConnected, connectionStatus }) {
  // Chain & token state
  const [sourceChain, setSourceChain] = useState(8453)
  const [destChain, setDestChain] = useState(42161)
  const [holdings, setHoldings] = useState([])
  const [selectedTokens, setSelectedTokens] = useState(new Map())
  const [outputToken, setOutputToken] = useState(null)
  const [customTokens, setCustomTokens] = useState([])
  const [blockedTokens, setBlockedTokens] = useState(new Map())

  // Loading states
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(false)
  const [isCheckingRoutes, setIsCheckingRoutes] = useState(false)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isBridging, setIsBridging] = useState(false)
  const [isLoadingCustomToken, setIsLoadingCustomToken] = useState(false)
  const [isLoadingSourceToken, setIsLoadingSourceToken] = useState(false)

  // Quote & status
  const [quote, setQuote] = useState(null)
  const [slippage, setSlippage] = useState(null)
  const [customSlippage, setCustomSlippage] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [bridgeProgress, setBridgeProgress] = useState(null)
  const [toast, setToast] = useState(null)
  const [customTokenAddress, setCustomTokenAddress] = useState('')
  const [customSourceTokenAddress, setCustomSourceTokenAddress] = useState('')
  const [successPanel, setSuccessPanel] = useState(null)
  const [bridgePanelMode, setBridgePanelMode] = useState('idle')

  // Route fallback state
  const [excludedSwapSources, setExcludedSwapSources] = useState([])
  const [useFallbacks, setUseFallbacks] = useState(false)
  const [useExternalLiquidity, setUseExternalLiquidity] = useState(false)

  // Refs
  const fetchingRef = useRef(false)
  const skipNextHoldingsRefreshRef = useRef(false)
  const blockedTokensRef = useRef(blockedTokens)
  const toastTimerRef = useRef(null)

  useEffect(() => { blockedTokensRef.current = blockedTokens }, [blockedTokens])
  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [])

  // Toast
  const showToast = useCallback((message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // Blocked token helpers
  const getBlockedReason = useCallback((token, chainIdOverride = null) => {
    if (!token?.address) return null
    const chainId = Number(chainIdOverride ?? token.chainId ?? sourceChain)
    return blockedTokens.get(getTokenKey(chainId, token.address)) || null
  }, [blockedTokens, sourceChain])

  const applyBlockedTokens = useCallback((tokens, chainIdOverride = null) => {
    if (!Array.isArray(tokens) || blockedTokens.size === 0) return tokens
    return tokens.map(token => {
      const chainId = Number(chainIdOverride ?? token.chainId ?? sourceChain)
      const reason = blockedTokens.get(getTokenKey(chainId, token.address))
      if (!reason) return token
      return { ...token, routeAvailable: false, blockedReason: reason }
    })
  }, [blockedTokens, sourceChain])

  const markTokensBlocked = useCallback((tokens, reason, chainIdOverride = null) => {
    if (!tokens || tokens.length === 0) return
    const reasonText = reason || 'Token is not supported'
    setBlockedTokens(prev => {
      const next = new Map(prev)
      for (const token of tokens) {
        if (!token?.address) continue
        const chainId = Number(chainIdOverride ?? token.chainId ?? sourceChain)
        if (!Number.isFinite(chainId)) continue
        next.set(getTokenKey(chainId, token.address), reasonText)
      }
      return next
    })
  }, [sourceChain])

  // ─── Token detection ─────────────────────────────────────

  const detectTransferFeeReason = async (token, chainIdOverride = null) => {
    if (!token?.address) return null
    const chainId = Number(chainIdOverride ?? token.chainId ?? sourceChain)
    if (!Number.isFinite(chainId)) return null
    try {
      const isFee = await detectTransferFeeToken(chainId, token.address)
      return isFee ? TRANSFER_FEE_REASON : null
    } catch { return null }
  }

  const detectTransferFeeTokens = useCallback(async (tokens, chainIdOverride = null) => {
    if (!Array.isArray(tokens) || tokens.length === 0) return []
    const chainId = Number(chainIdOverride ?? sourceChain)
    if (!Number.isFinite(chainId)) return []
    const tokenAddresses = tokens.map(t => t?.address).filter(Boolean)
    const feeResults = await detectTransferFeeTokensBatch(chainId, tokenAddresses)
    const blocked = []
    for (const token of tokens) {
      if (!token?.address) continue
      if (feeResults.get(token.address.toLowerCase())) blocked.push(token)
    }
    return blocked
  }, [sourceChain])

  const blockTokens = useCallback((tokens, reason) => {
    if (!tokens || tokens.length === 0) return
    const reasonText = reason || 'Token is not supported'
    const keys = tokens.map(token => getTokenKey(token.chainId ?? sourceChain, token.address))
    const keySet = new Set(keys)
    markTokensBlocked(tokens, reasonText)
    setHoldings(prev => prev.map(token => {
      const tokenKey = getTokenKey(token.chainId ?? sourceChain, token.address)
      if (keySet.has(tokenKey)) return { ...token, routeAvailable: false, blockedReason: reasonText }
      return token
    }))
    setSelectedTokens(prev => {
      const next = new Map(prev)
      for (const token of tokens) next.delete(token.address)
      return next
    })
  }, [sourceChain, markTokensBlocked])

  // ─── Holdings ────────────────────────────────────────────

  const loadHoldings = useCallback(async () => {
    if (connectionStatus !== 'connected' || !address || fetchingRef.current) return
    fetchingRef.current = true
    setIsLoadingHoldings(true)
    setStatus({ type: '', message: 'Loading token balances...' })
    try {
      const tokens = await fetchTokenHoldings(address, sourceChain)
      if (tokens.length > 0) {
        const sortedTokens = tokens.map(t => ({ ...t, routeAvailable: null }))
          .sort((a, b) => b.valueUsd - a.valueUsd)
        const tokensToCheck = sortedTokens.filter(
          token => !blockedTokensRef.current.has(getTokenKey(sourceChain, token.address))
        )
        const feeTokens = await detectTransferFeeTokens(tokensToCheck, sourceChain)
        let blockedMap = new Map(blockedTokensRef.current)
        let didAdd = false
        for (const token of feeTokens) {
          const key = getTokenKey(sourceChain, token.address)
          if (!blockedMap.has(key)) { blockedMap.set(key, TRANSFER_FEE_REASON); didAdd = true }
        }
        if (didAdd) setBlockedTokens(blockedMap)

        const blockedApplied = sortedTokens.map(token => {
          const tokenKey = getTokenKey(sourceChain, token.address)
          const reason = blockedMap.get(tokenKey)
          if (!reason) return token
          return { ...token, routeAvailable: false, blockedReason: reason }
        })
        setHoldings(blockedApplied)
        setSelectedTokens(new Map())
        setQuote(null)
        setOutputToken(null)
        setExcludedSwapSources([])
        setUseFallbacks(false)
        setUseExternalLiquidity(false)
        const totalValue = sortedTokens.reduce((sum, t) => sum + t.valueUsd, 0)
        const blockedCount = blockedApplied.filter(t => t.blockedReason === TRANSFER_FEE_REASON).length
        const blockedSuffix = blockedCount > 0 ? ` • ${blockedCount} transfer-fee tokens blocked` : ''
        setStatus({ type: 'success', message: `Found ${sortedTokens.length} tokens worth ${formatUsd(totalValue)}. Select output token to check routes.${blockedSuffix}` })
      } else {
        setHoldings([])
        setStatus({ type: '', message: 'No verified tokens found with USD value' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Failed to load token balances' })
      setHoldings([])
    } finally {
      setIsLoadingHoldings(false)
      fetchingRef.current = false
    }
  }, [connectionStatus, address, sourceChain, detectTransferFeeTokens])

  const recheckRoutes = useCallback(async () => {
    if (!address || holdings.length === 0 || !outputToken) return
    setIsCheckingRoutes(true)
    setStatus({ type: '', message: `Checking routes to ${outputToken.symbol}...` })
    try {
      const tokensWithRoutes = await checkRoutesAvailability(sourceChain, destChain, holdings, address, outputToken.address)
      const sortedTokens = tokensWithRoutes.sort((a, b) => {
        if (a.routeAvailable && !b.routeAvailable) return -1
        if (!a.routeAvailable && b.routeAvailable) return 1
        return b.valueUsd - a.valueUsd
      })
      const blockedApplied = applyBlockedTokens(sortedTokens, sourceChain)
      setHoldings(blockedApplied)
      setSelectedTokens(new Map())
      setQuote(null)
      const routeableTokens = blockedApplied.filter(t => t.routeAvailable)
      const totalValue = routeableTokens.reduce((sum, t) => sum + t.valueUsd, 0)
      const unavailableCount = sortedTokens.length - routeableTokens.length
      let message = `Found ${routeableTokens.length} tokens bridgeable to ${outputToken.symbol} (${formatUsd(totalValue)})`
      if (unavailableCount > 0) message += ` • ${unavailableCount} unavailable`
      setStatus({ type: 'success', message })
    } catch {
      setStatus({ type: 'error', message: 'Failed to check routes' })
    } finally { setIsCheckingRoutes(false) }
  }, [address, sourceChain, destChain, holdings, outputToken, applyBlockedTokens])

  useEffect(() => {
    if (connectionStatus !== 'connected' || !address || !sourceChain) return
    if (fetchingRef.current) return
    if (skipNextHoldingsRefreshRef.current) { skipNextHoldingsRefreshRef.current = false; return }
    loadHoldings()
  }, [connectionStatus, address, sourceChain, loadHoldings])

  useEffect(() => {
    if (connectionStatus !== 'connected' || !address || holdings.length === 0) return
    if (!outputToken || isBridging) return
    recheckRoutes()
  }, [outputToken, destChain]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Chain swap ──────────────────────────────────────────

  const handleSwapChains = useCallback(() => {
    if (isBridging) return
    setSourceChain(destChain)
    setDestChain(sourceChain)
    setOutputToken(null)
    setCustomTokens([])
    setSelectedTokens(new Map())
    setQuote(null)
    setExcludedSwapSources([])
    setUseFallbacks(false)
    setUseExternalLiquidity(false)
  }, [sourceChain, destChain, isBridging])

  // ─── Token selection ─────────────────────────────────────

  const toggleToken = async (token) => {
    if (isBridging) return
    const blockedReason = getBlockedReason(token, sourceChain)
    if (blockedReason) { showToast(blockedReason); return }
    const feeReason = await detectTransferFeeReason(token, sourceChain)
    if (feeReason) { blockTokens([token], feeReason); showToast(feeReason); return }
    const newSelected = new Map(selectedTokens)
    if (newSelected.has(token.address)) {
      newSelected.delete(token.address)
    } else {
      if (newSelected.size >= MAX_BATCH_TOKENS) { showToast(`Maximum ${MAX_BATCH_TOKENS} tokens per batch`); return }
      const amountInput = getMaxTokenInput(token)
      newSelected.set(token.address, { token, amount: token.balance, amountInput })
    }
    setSelectedTokens(newSelected)
    setQuote(null)
  }

  const getMaxTokenInput = (token) => {
    try {
      const formatted = formatUnits(BigInt(token.balance || '0'), token.decimals ?? 18)
      return clampToDecimals(formatted, 5)
    } catch { return '' }
  }

  const clampToDecimals = (value, maxDecimals) => {
    if (!value) return ''
    const [whole, fraction = ''] = value.split('.')
    const trimmedFraction = fraction.slice(0, maxDecimals)
    if (!trimmedFraction) return whole
    return `${whole}.${trimmedFraction}`
  }

  const updateTokenAmount = (address, nextValue) => {
    const newSelected = new Map(selectedTokens)
    const entry = newSelected.get(address)
    if (!entry) return
    const cleaned = nextValue.replace(/[^0-9.]/g, '')
    const normalized = clampToDecimals(cleaned, 5)
    let amount = entry.amount
    let amountInput = entry.amountInput || ''
    if (normalized === '') { amount = '0'; amountInput = '' }
    else {
      try {
        amount = parseUnits(normalized, entry.token.decimals ?? 18).toString()
        amountInput = normalized
      } catch { amount = entry.amount; amountInput = entry.amountInput || '' }
    }
    try {
      const maxAmount = BigInt(entry.token.balance || '0')
      const parsedAmount = BigInt(amount || '0')
      if (parsedAmount > maxAmount) { amount = entry.token.balance; amountInput = getMaxTokenInput(entry.token) }
    } catch { amount = entry.amount; amountInput = entry.amountInput || '' }
    newSelected.set(address, { ...entry, amount, amountInput })
    setSelectedTokens(newSelected)
    setQuote(null)
  }

  const setMaxAmount = (address) => {
    const newSelected = new Map(selectedTokens)
    const entry = newSelected.get(address)
    if (!entry) return
    const amountInput = getMaxTokenInput(entry.token)
    newSelected.set(address, { ...entry, amount: entry.token.balance, amountInput })
    setSelectedTokens(newSelected)
    setQuote(null)
  }

  const handleOutputTokenSelect = async (token) => {
    const blockedReason = getBlockedReason(token, destChain)
    if (blockedReason) { showToast(blockedReason); return }
    const feeReason = await detectTransferFeeReason(token, destChain)
    if (feeReason) { markTokensBlocked([token], feeReason, destChain); showToast(feeReason); return }
    setOutputToken(token)
    setQuote(null)
    setExcludedSwapSources([])
    setUseFallbacks(false)
    setUseExternalLiquidity(false)
    setHoldings(prev => applyBlockedTokens(prev.map(t => ({ ...t, routeAvailable: null })), sourceChain))
  }

  // ─── Quote ───────────────────────────────────────────────

  const fetchQuote = async ({
    excludedSwapSourcesOverride = null,
    useFallbacksOverride = null,
    useExternalLiquidityOverride = null,
    statusMessage = 'Getting best route...',
    selectedEntriesOverride = null,
    walletCapabilities: caps = { explicitDeposit: true },
  } = {}) => {
    const hasSelection = selectedEntriesOverride ? selectedEntriesOverride.length > 0 : selectedTokens.size > 0
    if (!hasSelection || !outputToken || !address) return null
    const activeExcludedSources = excludedSwapSourcesOverride ?? excludedSwapSources
    const activeFallbacks = useFallbacksOverride ?? useFallbacks
    const activeExternalLiquidity = useExternalLiquidityOverride ?? useExternalLiquidity
    const explicitDeposit = caps?.explicitDeposit ?? true
    setQuote(null)
    setIsLoadingQuote(true)
    if (statusMessage) setStatus({ type: '', message: statusMessage })
    try {
      let quoteResult
      let excludedOrigins = []
      let excludedHighImpactOrigins = []
      let failedOrigins = []
      let singleTokenMode = false
      const rawEntries = selectedEntriesOverride ?? Array.from(selectedTokens.values())
      const selectedEntries = rawEntries.filter(entry => {
        try { return BigInt(entry.amount || '0') > 0n } catch { return false }
      }).filter(entry => !getBlockedReason(entry.token, entry.token.chainId ?? sourceChain))
      if (selectedEntries.length === 0) { showToast('Enter an amount greater than 0'); setStatus({ type: '', message: '' }); return null }
      if (selectedEntries.length === 1) {
        const [entry] = selectedEntries; singleTokenMode = true
        quoteResult = await getBridgeQuote({
          user: address, originChainId: sourceChain, destinationChainId: destChain,
          originCurrency: entry.token.address, destinationCurrency: outputToken.address,
          amount: entry.amount, slippageTolerance: slippage, recipient: address,
          excludedSwapSources: activeExcludedSources, explicitDeposit,
          useFallbacks: activeFallbacks, useExternalLiquidity: activeExternalLiquidity,
        })
      } else {
        const origins = selectedEntries.map(entry => ({
          chainId: sourceChain, currency: entry.token.address, amount: entry.amount, symbol: entry.token.symbol,
        }))
        const isSameChain = sourceChain === destChain
        if (isSameChain) {
          quoteResult = await getAggregatedSwapQuotes({
            user: address, origins, destinationChainId: destChain, destinationCurrency: outputToken.address,
            slippageTolerance: slippage, recipient: address, excludedSwapSources: activeExcludedSources,
            explicitDeposit, useFallbacks: activeFallbacks, useExternalLiquidity: activeExternalLiquidity,
          })
          excludedHighImpactOrigins = quoteResult._excludedOrigins || []
          failedOrigins = quoteResult._failedOrigins || []
          excludedOrigins = [...excludedHighImpactOrigins, ...failedOrigins]
        } else {
          const preflight = await getAggregatedSwapQuotes({
            user: address, origins, destinationChainId: destChain, destinationCurrency: outputToken.address,
            slippageTolerance: slippage, recipient: address, excludedSwapSources: activeExcludedSources,
            explicitDeposit, useFallbacks: activeFallbacks, useExternalLiquidity: activeExternalLiquidity,
          })
          excludedHighImpactOrigins = preflight._excludedOrigins || []
          failedOrigins = preflight._failedOrigins || []
          excludedOrigins = [...excludedHighImpactOrigins, ...failedOrigins]
          const validOrigins = preflight._validOrigins || origins
          if (validOrigins.length === 0) {
            setStatus({ type: 'error', message: `All selected tokens exceeded ${MAX_PRICE_IMPACT}% price impact. Try smaller amounts or different tokens.` })
            setQuote(null); return null
          }
          if (validOrigins.length === 1) {
            const origin = validOrigins[0]; singleTokenMode = true
            quoteResult = await getBridgeQuote({
              user: address, originChainId: origin.chainId, destinationChainId: destChain,
              originCurrency: origin.currency, destinationCurrency: outputToken.address,
              amount: origin.amount, slippageTolerance: slippage, recipient: address,
              excludedSwapSources: activeExcludedSources, explicitDeposit,
              useFallbacks: activeFallbacks, useExternalLiquidity: activeExternalLiquidity,
            })
          } else {
            quoteResult = await getMultiInputQuote({
              user: address, origins: validOrigins, destinationChainId: destChain,
              destinationCurrency: outputToken.address, slippageTolerance: slippage, recipient: address,
              explicitDeposit, useFallbacks: activeFallbacks, useExternalLiquidity: activeExternalLiquidity,
            })
          }
        }
      }
      // Handle excluded tokens
      if (excludedOrigins.length > 0) pruneSelectedTokens(excludedOrigins)
      // Check price impact for single token
      if (singleTokenMode) {
        const priceImpact = Math.abs(parseFloat(quoteResult?.details?.totalImpact?.percent || 0))
        if (priceImpact > MAX_PRICE_IMPACT) {
          setStatus({ type: 'error', message: `Price impact ${priceImpact.toFixed(1)}% exceeds ${MAX_PRICE_IMPACT}%. Reduce the amount or choose another token.` })
          setQuote(null); return null
        }
      }
      if (excludedOrigins.length === 0) setStatus({ type: 'success', message: 'Quote ready' })
      try { quoteResult = await filterApproveStepsByAllowance(quoteResult, address) } catch {}
      setQuote(quoteResult)
      return quoteResult
    } catch (error) {
      setStatus({ type: 'error', message: getFriendlyErrorMessage(error) })
      setQuote(null)
      return null
    } finally { setIsLoadingQuote(false) }
  }

  const pruneSelectedTokens = (origins) => {
    if (!origins || origins.length === 0) return
    const removeSet = new Set(origins.map(origin => origin.currency.toLowerCase()))
    setSelectedTokens(prev => {
      const next = new Map()
      for (const [address, entry] of prev.entries()) {
        if (!removeSet.has(address.toLowerCase())) next.set(address, entry)
      }
      return next
    })
  }

  const handleGetQuote = () => fetchQuote({ walletCapabilities })

  // ─── Custom tokens ───────────────────────────────────────

  const handleAddCustomToken = async () => {
    if (!customTokenAddress.trim() || isLoadingCustomToken) return
    setIsLoadingCustomToken(true)
    try {
      const tokenData = await fetchTokenMetadata(destChain, customTokenAddress.trim())
      const feeReason = await detectTransferFeeReason(tokenData, destChain)
      if (feeReason) markTokensBlocked([tokenData], feeReason, destChain)
      setCustomTokens(prev => {
        const exists = prev.some(t => t.address.toLowerCase() === tokenData.address.toLowerCase())
        return exists ? prev : [...prev, tokenData]
      })
      if (!feeReason) await handleOutputTokenSelect(tokenData)
      setCustomTokenAddress('')
      showToast(feeReason || `Added ${tokenData.symbol}`)
    } catch (error) {
      showToast(error.message || 'Failed to add token')
    } finally { setIsLoadingCustomToken(false) }
  }

  const handleAddSourceToken = async () => {
    if (!customSourceTokenAddress.trim() || isLoadingSourceToken) return
    if (!address) { showToast('Connect wallet first'); return }
    setIsLoadingSourceToken(true)
    try {
      const tokenData = await fetchTokenMetadata(sourceChain, customSourceTokenAddress.trim())
      const balance = await fetchTokenBalance(sourceChain, tokenData.address, address)
      if (balance === '0') { showToast(`No ${tokenData.symbol} balance on ${getChainById(sourceChain)?.name}`); return }
      const baseToken = {
        address: tokenData.address, symbol: tokenData.symbol, name: tokenData.name,
        decimals: tokenData.decimals, balance, balanceFormatted: formatBalance(balance, tokenData.decimals),
        price: 0, valueUsd: 0, chainId: Number(sourceChain), logo: tokenData.logo,
        verified: true, routeAvailable: null,
      }
      const pricedToken = await applyRelayPriceToToken(baseToken, sourceChain)
      const feeReason = await detectTransferFeeReason(pricedToken, sourceChain)
      if (feeReason) markTokensBlocked([pricedToken], feeReason, sourceChain)
      const blockedReason = feeReason || getBlockedReason(pricedToken, sourceChain)
      const nextToken = blockedReason ? { ...pricedToken, routeAvailable: false, blockedReason } : pricedToken
      setHoldings(prev => {
        const exists = prev.some(t => t.address.toLowerCase() === tokenData.address.toLowerCase())
        return exists ? prev : [nextToken, ...prev]
      })
      if (outputToken && !blockedReason) {
        const routeCheck = await checkRouteAvailability(sourceChain, destChain, tokenData.address, address, tokenData.decimals, outputToken.address)
        setHoldings(prev => prev.map(t => {
          if (t.address.toLowerCase() === tokenData.address.toLowerCase()) {
            const existingReason = t.blockedReason || getBlockedReason(t, sourceChain)
            if (existingReason) return { ...t, routeAvailable: false, blockedReason: existingReason }
            return { ...t, routeAvailable: routeCheck.available }
          }
          return t
        }))
      }
      setCustomSourceTokenAddress('')
      showToast(blockedReason || `Added ${tokenData.symbol}`)
    } catch (error) { showToast(error.message || 'Failed to add token') }
    finally { setIsLoadingSourceToken(false) }
  }

  // ─── Bridge execution ────────────────────────────────────

  const handleBridge = async ({ walletClient, sendCallsAsync, resetBatchCalls, switchChainAsync, connectedChainId: connChainId, walletCapabilities: caps, DATA_SUFFIX }) => {
    if (!quote || !address || !walletClient) return
    setIsBridging(true)
    setBridgeProgress({ step: 'preparing', message: 'Preparing transaction...' })
    let shouldReset = true
    setBridgePanelMode('processing')
    try {
      const stepsQueue = [...(quote.steps || [])]
      const statusEndpoints = new Set()
      let pendingCalls = []
      let pendingChainId = null
      let activeChainId = connChainId

      const ensureChain = async (chainId) => {
        const targetChainId = Number(chainId || sourceChain)
        if (activeChainId !== targetChainId) {
          setBridgeProgress({ step: 'switching', message: `Switching to ${getChainById(targetChainId)?.name || 'source chain'}...` })
          await switchChainAsync({ chainId: targetChainId })
          activeChainId = targetChainId
        }
      }

      const submitCalls = async (calls, chainId) => {
        if (!calls.length) return
        await ensureChain(chainId)
        const supportsAtomicBatch = caps?.supportsAtomicBatch ?? true
        setBridgeProgress({ step: 'signing', message: supportsAtomicBatch ? `Sign ${calls.length} transaction(s)...` : `Sign ${calls.length} transaction(s) in sequence...` })
        if (supportsAtomicBatch) {
          try {
            await sendCallsAsync({ chainId: Number(chainId || sourceChain), calls,
              capabilities: { dataSuffix: { value: DATA_SUFFIX, optional: true } }
            })
          } catch (batchError) {
            const errorText = String(batchError).toLowerCase()
            if (errorText.includes('not supported') || errorText.includes('unsupported') || errorText.includes('sendcalls') || errorText.includes('atomicbatch')) {
              for (const call of calls) {
                await walletClient.sendTransaction({ account: walletClient.account, to: call.to, data: call.data, value: call.value, gas: call.gas, maxFeePerGas: call.maxFeePerGas, maxPriorityFeePerGas: call.maxPriorityFeePerGas })
              }
            } else throw batchError
          }
        } else {
          for (const call of calls) {
            await walletClient.sendTransaction({ account: walletClient.account, to: call.to, data: call.data, value: call.value, gas: call.gas, maxFeePerGas: call.maxFeePerGas, maxPriorityFeePerGas: call.maxPriorityFeePerGas })
          }
        }
        setBridgeProgress({ step: 'confirming', message: 'Waiting for confirmation...' })
      }

      const flushPendingCalls = async () => {
        if (!pendingCalls.length) return
        const callsToSend = pendingCalls; const chainIdToUse = pendingChainId
        pendingCalls = []; pendingChainId = null
        await submitCalls(callsToSend, chainIdToUse)
      }

      for (let i = 0; i < stepsQueue.length; i++) {
        const step = stepsQueue[i]
        if (!step?.items || step.items.length === 0) continue
        const stepKind = step.kind || (step.items.some(item => item.data?.sign) ? 'signature' : 'transaction')
        if (stepKind === 'signature') {
          await flushPendingCalls()
          setBridgeProgress({ step: 'signing', message: step.description || 'Sign authorization...' })
          for (const item of step.items) {
            const signData = item.data?.sign; const postData = item.data?.post
            if (!signData || !postData) throw new Error('Missing signature data from Relay')
            const signature = await signRelayPayload(signData, walletClient)
            const response = await submitRelaySignature({ signature, post: postData })
            if (Array.isArray(response?.steps) && response.steps.length > 0) stepsQueue.splice(i + 1, 0, ...response.steps)
            if (item.check?.endpoint) statusEndpoints.add(item.check.endpoint)
          }
          if (step.requestId) statusEndpoints.add(`/intents/status/v3?requestId=${step.requestId}`)
        }
        if (stepKind === 'transaction') {
          for (const item of step.items) {
            if (item.check?.endpoint) statusEndpoints.add(item.check.endpoint)
            if (!item.data) continue
            const itemChainId = Number(item.data.chainId || sourceChain)
            if (pendingChainId && pendingChainId !== itemChainId) await flushPendingCalls()
            if (!pendingChainId) pendingChainId = itemChainId
            pendingCalls.push({
              to: item.data.to, data: item.data.data, value: BigInt(item.data.value || '0'),
              gas: item.data.gas ? BigInt(item.data.gas) : undefined,
              maxFeePerGas: item.data.maxFeePerGas ? BigInt(item.data.maxFeePerGas) : undefined,
              maxPriorityFeePerGas: item.data.maxPriorityFeePerGas ? BigInt(item.data.maxPriorityFeePerGas) : undefined,
            })
          }
          if (step.requestId) statusEndpoints.add(`/intents/status/v3?requestId=${step.requestId}`)
        }
      }
      await flushPendingCalls()
      if (Array.isArray(quote.requestIds)) {
        for (const requestId of quote.requestIds) statusEndpoints.add(`/intents/status/v3?requestId=${requestId}`)
      }
      if (statusEndpoints.size > 0) {
        setBridgeProgress({ step: 'polling', message: `Waiting for ${statusEndpoints.size} swap(s)...` })
        const results = await Promise.all(Array.from(statusEndpoints).map(endpoint => pollBridgeStatus(endpoint)))
        const failedResults = results.filter(result => !result.success)
        if (failedResults.length === 0) {
          setBridgeProgress({ step: 'complete', message: 'All swaps complete!' })
          setStatus({ type: 'success', message: 'Tokens swapped successfully!' })
          setSuccessPanel({ title: 'Bridge complete', message: '' })
          setBridgePanelMode('success')
          shouldReset = false
        } else {
          const terminalFailures = new Set(['failure', 'failed', 'reverted', 'refund', 'refunded'])
          const failureStatusValues = failedResults.map(result => String(result.status?.status || '').toLowerCase()).filter(Boolean)
          const hasTerminalFailure = failureStatusValues.some(s => terminalFailures.has(s))
          setBridgeProgress({ step: 'complete', message: hasTerminalFailure ? 'Bridge failed' : 'Bridge pending' })
          setStatus({ type: hasTerminalFailure ? 'error' : 'warning', message: `${failedResults.find(result => result.error)?.error || (hasTerminalFailure ? 'Bridge failed or refunded.' : 'Bridge is still pending.')} Check your wallet or Relay status for updates.` })
          setSuccessPanel(null); setBridgePanelMode('idle')
        }
        skipNextHoldingsRefreshRef.current = true
      } else {
        setBridgeProgress({ step: 'complete', message: 'Transaction complete!' })
        setStatus({ type: 'success', message: 'Transaction complete!' })
        skipNextHoldingsRefreshRef.current = true
      }
    } catch (error) {
      handleBridgeError(error)
    } finally {
      setIsBridging(false)
      setBridgeProgress(null)
      if (shouldReset) { setQuote(null); setSelectedTokens(new Map()) }
      resetBatchCalls()
    }
  }

  const handleBridgeError = async (error) => {
    if (isUserRejection(error)) {
      setStatus({ type: '', message: 'Transaction cancelled' })
      skipNextHoldingsRefreshRef.current = true
      setBridgePanelMode('idle')
    } else {
      setStatus({ type: 'error', message: getFriendlyErrorMessage(error) })
      setBridgePanelMode('idle')
    }
  }

  // ─── Helpers ─────────────────────────────────────────────

  const findRevertSelector = (value) => {
    if (!value) return null
    const text = String(value).toLowerCase()
    const match = text.match(/0xe450d38c[a-f0-9]{192}/)
    return match ? match[0] : null
  }

  const getErrorText = (error) => {
    if (!error) return ''
    const parts = [error.message, error.shortMessage, error.data, error.errorData, error.cause?.message, error.cause?.shortMessage, error.cause?.data, error.cause?.errorData, error.cause?.cause?.message, error.cause?.cause?.shortMessage, error.cause?.cause?.data, error.cause?.cause?.errorData].filter(Boolean)
    let extra = ''; try { extra = JSON.stringify(error) } catch {}
    return `${parts.join(' ')} ${extra}`.toLowerCase()
  }

  const getFriendlyErrorMessage = (error) => {
    if (!error) return 'An error occurred. Please try again.'
    const errorCode = error.code || error.errorCode
    if (errorCode && RELAY_ERROR_CODES[errorCode]) return getRelayErrorMessage(errorCode, error.message)
    const text = getErrorText(error)
    if (text.includes('no route') || text.includes('no swap route')) return getRelayErrorMessage(RELAY_ERROR_CODES.NO_SWAP_ROUTES_FOUND)
    if (text.includes('insufficient liquidity') || text.includes('not enough liquidity')) return getRelayErrorMessage(RELAY_ERROR_CODES.INSUFFICIENT_LIQUIDITY)
    if (text.includes('price impact') || text.includes('swap impact')) return getRelayErrorMessage(RELAY_ERROR_CODES.SWAP_IMPACT_TOO_HIGH)
    if (text.includes('amount too low') || text.includes('minimum amount')) return getRelayErrorMessage(RELAY_ERROR_CODES.AMOUNT_TOO_LOW)
    if (text.includes('insufficient funds') || text.includes('insufficient balance')) return getRelayErrorMessage(RELAY_ERROR_CODES.INSUFFICIENT_FUNDS)
    if (text.includes('unsupported currency') || text.includes('invalid currency')) return getRelayErrorMessage(RELAY_ERROR_CODES.UNSUPPORTED_CURRENCY)
    return error.message || 'An error occurred. Please try again.'
  }

  const signRelayPayload = async (signData, walletClient) => {
    if (!signData) throw new Error('Missing signature payload')
    if (!walletClient) throw new Error('Wallet not connected')
    const signatureKind = String(signData.signatureKind || '').toLowerCase()
    const account = walletClient.account || address
    if (signatureKind === 'eip191') {
      const message = signData.message
      if (!message) throw new Error('Missing message to sign')
      if (typeof message === 'string' && /^0x[0-9a-fA-F]*$/.test(message)) {
        return await walletClient.signMessage({ account, message: { raw: message } })
      }
      return await walletClient.signMessage({ account, message: String(message) })
    }
    if (signatureKind === 'eip712') {
      const domain = normalizeTypedDataDomain(signData.domain)
      const { types, primaryType } = signData
      const value = signData.value ?? signData.message
      if (!domain || !types || !primaryType || value === undefined) throw new Error('Incomplete typed data for signature')
      return await walletClient.signTypedData({ account, domain, types, primaryType, message: value })
    }
    throw new Error(`Unsupported signature kind: ${signatureKind || 'unknown'}`)
  }

  const normalizeTypedDataDomain = (domain) => {
    if (!domain || typeof domain !== 'object') return domain
    const chainId = domain.chainId
    if (typeof chainId === 'string') {
      const parsed = chainId.startsWith('0x') ? Number.parseInt(chainId, 16) : Number(chainId)
      if (Number.isFinite(parsed)) return { ...domain, chainId: parsed }
    }
    return domain
  }

  const handleBridgeAgain = () => {
    setSuccessPanel(null)
    setBridgePanelMode('idle')
    setQuote(null)
    setSelectedTokens(new Map())
    setStatus({ type: '', message: '' })
    setBridgeProgress(null)
    setExcludedSwapSources([])
    setUseFallbacks(false)
    setUseExternalLiquidity(false)
    loadHoldings()
  }

  const handleCloseBridgePanel = () => {
    setSuccessPanel(null)
    setBridgePanelMode('idle')
    loadHoldings()
  }

  // ─── Computed values ─────────────────────────────────────

  const activeSelectionCount = Array.from(selectedTokens.values()).reduce((count, entry) => {
    try { return count + (BigInt(entry.amount || '0') > 0n ? 1 : 0) } catch { return count }
  }, 0)

  const selectedTotal = Array.from(selectedTokens.values()).reduce((sum, entry) => {
    const amountValue = Number(entry.amountInput || 0)
    if (Number.isFinite(amountValue) && entry.token.price) return sum + (amountValue * entry.token.price)
    return sum + (entry.token.valueUsd || 0)
  }, 0)

  const getOutputAmount = () => {
    if (!quote?.details?.currencyOut) return null
    const out = quote.details.currencyOut
    return { amount: out.amountFormatted, usd: out.amountUsd }
  }

  const getFees = () => {
    if (!quote?.fees) return null
    const { gas, relayer } = quote.fees
    return {
      gas: gas?.amountUsd || '0', relay: relayer?.amountUsd || '0',
      total: (parseFloat(gas?.amountUsd || 0) + parseFloat(relayer?.amountUsd || 0)).toFixed(2),
    }
  }

  const outputTokens = COMMON_TOKENS[destChain] || []

  return {
    // State
    sourceChain, setSourceChain, destChain, setDestChain,
    holdings, selectedTokens, outputToken, customTokens,
    isLoadingHoldings, isCheckingRoutes, isLoadingQuote, isBridging,
    isLoadingCustomToken, isLoadingSourceToken,
    quote, slippage, setSlippage, customSlippage, setCustomSlippage,
    status, bridgeProgress, toast, customTokenAddress, setCustomTokenAddress,
    customSourceTokenAddress, setCustomSourceTokenAddress,
    successPanel, bridgePanelMode, excludedSwapSources,
    useFallbacks, useExternalLiquidity, outputTokens,
    activeSelectionCount, selectedTotal,
    // Actions
    loadHoldings, handleSwapChains, toggleToken, updateTokenAmount,
    setMaxAmount, handleOutputTokenSelect, handleGetQuote,
    handleAddCustomToken, handleAddSourceToken, handleBridge,
    handleBridgeAgain, handleCloseBridgePanel,
    showToast, getBlockedReason, getFees, getOutputAmount, fetchQuote,
    MAX_BATCH_TOKENS,
  }
}
