import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi'
import { useSendCalls } from 'wagmi/experimental'
import { formatUnits, parseUnits } from 'viem'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import { BRIDGE_CHAINS, getChainById, COMMON_TOKENS } from './wagmi'
import {
    fetchTokenHoldings,
    fetchTokenMetadata,
    fetchTokenBalance,
    checkRoutesAvailability,
    checkRouteAvailability,
    formatBalance,
    filterApproveStepsByAllowance,
    formatUsd,
    applyRelayPriceToToken,
    resolveExplicitDeposit,
    getBridgeQuote,
    getMultiInputQuote,
    getAggregatedSwapQuotes,
    detectTransferFeeToken,
    detectTransferFeeTokensBatch,
    pollBridgeStatus,
    submitRelaySignature,
    SLIPPAGE_PRESETS,
    MAX_PRICE_IMPACT,
    isUserRejection,
    RELAY_ERROR_CODES,
    getRelayErrorMessage,
} from './bridgeService'


const SwapIcon = memo(() => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
))
SwapIcon.displayName = 'SwapIcon'

const LoaderIcon = memo(() => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
    </svg>
))
LoaderIcon.displayName = 'LoaderIcon'

const CheckIcon = memo(() => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
    </svg>
))
CheckIcon.displayName = 'CheckIcon'

const getTokenKey = (chainId, tokenAddress) => `${Number(chainId)}:${tokenAddress.toLowerCase()}`

export default function App() {
    const { open } = useAppKit()
    const { disconnect } = useDisconnect()
    const { address, isConnected, status: connectionStatus, chainId: connectedChainId } = useAccount()
    const { data: walletClient } = useWalletClient()
    const { switchChainAsync } = useSwitchChain()

    const { sendCallsAsync, reset: resetBatchCalls } = useSendCalls()

    const MAX_BATCH_TOKENS = 10
    const transferFeeReason = "Transfer-fee tokens aren't supported"
    const [sourceChain, setSourceChain] = useState(8453)
    const [destChain, setDestChain] = useState(42161)
    const [holdings, setHoldings] = useState([])
    const [selectedTokens, setSelectedTokens] = useState(new Map())
    const [outputToken, setOutputToken] = useState(null)
    const [quote, setQuote] = useState(null)
    const [slippage, setSlippage] = useState(null)
    const [customSlippage, setCustomSlippage] = useState('')
    const [blockedTokens, setBlockedTokens] = useState(new Map())

    const [isLoadingHoldings, setIsLoadingHoldings] = useState(false)
    const [isCheckingRoutes, setIsCheckingRoutes] = useState(false)
    const [isLoadingQuote, setIsLoadingQuote] = useState(false)
    const [isBridging, setIsBridging] = useState(false)
    const [status, setStatus] = useState({ type: '', message: '' })
    const [bridgeProgress, setBridgeProgress] = useState(null)
    const [toast, setToast] = useState(null)
    const [customTokenAddress, setCustomTokenAddress] = useState('')
    const [isLoadingCustomToken, setIsLoadingCustomToken] = useState(false)
    const [customTokens, setCustomTokens] = useState([])
    const [customSourceTokenAddress, setCustomSourceTokenAddress] = useState('')
    const [isLoadingSourceToken, setIsLoadingSourceToken] = useState(false)
    const [successPanel, setSuccessPanel] = useState(null)
    const [bridgePanelMode, setBridgePanelMode] = useState('idle')
    const [excludedSwapSources, setExcludedSwapSources] = useState([])
    const [useFallbacks, setUseFallbacks] = useState(false)
    const [useExternalLiquidity, setUseExternalLiquidity] = useState(false)
    const [walletCapabilities, setWalletCapabilities] = useState({
        explicitDeposit: true,
        supportsAtomicBatch: true,
    })

    const fetchingRef = useRef(false)
    const skipNextHoldingsRefreshRef = useRef(false)
    const blockedTokensRef = useRef(blockedTokens)

    useEffect(() => {
        if (!isConnected || !walletClient || !address || !sourceChain) return
        let isActive = true

        const resolveCapabilities = async () => {
            try {
                const result = await resolveExplicitDeposit({
                    walletClient,
                    address,
                    chainId: sourceChain,
                })
                if (!isActive) return
                setWalletCapabilities({
                    explicitDeposit: result.explicitDeposit ?? true,
                    supportsAtomicBatch: result.supportsAtomicBatch ?? true,
                })
            } catch { }
        }

        resolveCapabilities()

        return () => {
            isActive = false
        }
    }, [isConnected, walletClient, address, sourceChain])

    useEffect(() => {
        blockedTokensRef.current = blockedTokens
    }, [blockedTokens])

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

    const detectTransferFeeReason = async (token, chainIdOverride = null) => {
        if (!token?.address) return null
        const chainId = Number(chainIdOverride ?? token.chainId ?? sourceChain)
        if (!Number.isFinite(chainId)) return null
        try {
            const isFee = await detectTransferFeeToken(chainId, token.address)
            return isFee ? transferFeeReason : null
        } catch {
            return null
        }
    }

    const detectTransferFeeTokens = useCallback(async (tokens, chainIdOverride = null) => {
        if (!Array.isArray(tokens) || tokens.length === 0) return []
        const chainId = Number(chainIdOverride ?? sourceChain)
        if (!Number.isFinite(chainId)) return []

        // Use batch function for all tokens in a single RPC call
        const tokenAddresses = tokens.map(t => t?.address).filter(Boolean)
        const feeResults = await detectTransferFeeTokensBatch(chainId, tokenAddresses)

        const blocked = []
        for (const token of tokens) {
            if (!token?.address) continue
            const isFee = feeResults.get(token.address.toLowerCase())
            if (isFee) blocked.push(token)
        }
        return blocked
    }, [sourceChain])

    const recheckRoutes = useCallback(async () => {
        if (!address || holdings.length === 0 || !outputToken) return

        setIsCheckingRoutes(true)
        setStatus({ type: '', message: `Checking routes to ${outputToken.symbol}...` })

        try {
            const tokensWithRoutes = await checkRoutesAvailability(
                sourceChain,
                destChain,
                holdings,
                address,
                outputToken.address
            )

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
            if (unavailableCount > 0) {
                message += ` • ${unavailableCount} unavailable`
            }
            setStatus({ type: 'success', message })
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to check routes' })
        } finally {
            setIsCheckingRoutes(false)
        }
    }, [address, sourceChain, destChain, holdings, outputToken, applyBlockedTokens])

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

                const tokensToCheck = sortedTokens.filter(token => !blockedTokensRef.current.has(getTokenKey(sourceChain, token.address)))
                const feeTokens = await detectTransferFeeTokens(tokensToCheck, sourceChain)
                let blockedMap = new Map(blockedTokensRef.current)
                let didAdd = false
                if (feeTokens.length > 0) {
                    for (const token of feeTokens) {
                        const key = getTokenKey(sourceChain, token.address)
                        if (!blockedMap.has(key)) {
                            blockedMap.set(key, transferFeeReason)
                            didAdd = true
                        }
                    }
                }
                if (didAdd) {
                    setBlockedTokens(blockedMap)
                }

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
                const blockedCount = blockedApplied.filter(t => t.blockedReason === transferFeeReason).length
                const blockedSuffix = blockedCount > 0 ? ` • ${blockedCount} transfer-fee tokens blocked` : ''
                setStatus({ type: 'success', message: `Found ${sortedTokens.length} tokens worth ${formatUsd(totalValue)}. Select output token to check routes.${blockedSuffix}` })
            } else {
                setHoldings([])
                setStatus({ type: '', message: 'No verified tokens found with USD value' })
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to load token balances' })
            setHoldings([])
        } finally {
            setIsLoadingHoldings(false)
            fetchingRef.current = false
        }
    }, [connectionStatus, address, sourceChain, detectTransferFeeTokens, transferFeeReason])

    useEffect(() => {
        if (connectionStatus !== 'connected' || !address || !sourceChain) return
        if (fetchingRef.current) return
        if (skipNextHoldingsRefreshRef.current) {
            skipNextHoldingsRefreshRef.current = false
            return
        }

        loadHoldings()
    }, [connectionStatus, address, sourceChain, loadHoldings])

    useEffect(() => {
        if (connectionStatus !== 'connected' || !address || holdings.length === 0) return
        if (!outputToken || isBridging) return

        recheckRoutes()
    }, [outputToken, destChain])

    const handleSwapChains = () => {
        if (isBridging) return
        const temp = sourceChain
        setSourceChain(destChain)
        setDestChain(temp)
        setOutputToken(null)
        setCustomTokens([])
        setSelectedTokens(new Map())
        setQuote(null)
        setExcludedSwapSources([])
        setUseFallbacks(false)
        setUseExternalLiquidity(false)
    }


    const findRevertSelector = (value) => {
        if (!value) return null
        const text = String(value).toLowerCase()
        const match = text.match(/0xe450d38c[a-f0-9]{192}/)
        return match ? match[0] : null
    }

    const collectErrorStrings = (value, limit = 200) => {
        const values = []
        const seen = new Set()
        const queue = [value]

        while (queue.length > 0 && values.length < limit) {
            const current = queue.pop()
            if (!current) continue

            if (typeof current === 'string') {
                values.push(current)
                continue
            }

            if (typeof current === 'number' || typeof current === 'bigint' || typeof current === 'boolean') {
                values.push(String(current))
                continue
            }

            if (typeof current !== 'object') {
                continue
            }

            if (seen.has(current)) {
                continue
            }
            seen.add(current)

            if (Array.isArray(current)) {
                for (const item of current) {
                    queue.push(item)
                }
                continue
            }

            for (const entry of Object.values(current)) {
                queue.push(entry)
            }
        }

        return values
    }

    const extractRevertData = (error) => {
        const candidates = [
            error?.data,
            error?.errorData,
            error?.cause?.data,
            error?.cause?.cause?.data,
            error?.details,
            error?.metaMessages,
            error?.meta,
            error?.stack,
            error?.shortMessage,
            error?.message,
            error?.cause?.message,
        ].filter(Boolean)

        for (const candidate of candidates) {
            const match = findRevertSelector(candidate)
            if (match) {
                return match
            }
        }

        try {
            const serialized = JSON.stringify(error).toLowerCase()
            const match = serialized.match(/0xe450d38c[a-f0-9]{192}/)
            if (match) {
                return match[0]
            }
        } catch {
        }

        const fallbackMatches = collectErrorStrings(error)
        for (const text of fallbackMatches) {
            const match = findRevertSelector(text)
            if (match) {
                return match
            }
        }

        return null
    }

    const parseErc20InsufficientBalance = (error) => {
        const hex = extractRevertData(error)
        if (!hex) return null
        const payload = hex.slice(10)
        if (payload.length < 192) return null

        try {
            const address = `0x${payload.slice(24, 64)}`
            const balance = BigInt(`0x${payload.slice(64, 128)}`)
            const needed = BigInt(`0x${payload.slice(128, 192)}`)
            const ratioBps = needed > 0n ? (balance * 10000n) / needed : null
            return { address, balance, needed, ratioBps }
        } catch {
            return null
        }
    }

    const getErrorText = (error) => {
        if (!error) return ''
        const parts = [
            error.message,
            error.shortMessage,
            error.data,
            error.errorData,
            error.cause?.message,
            error.cause?.shortMessage,
            error.cause?.data,
            error.cause?.errorData,
            error.cause?.cause?.message,
            error.cause?.cause?.shortMessage,
            error.cause?.cause?.data,
            error.cause?.cause?.errorData,
        ].filter(Boolean)
        let extra = ''
        try {
            extra = JSON.stringify(error)
        } catch {
            extra = ''
        }
        return `${parts.join(' ')} ${extra}`.toLowerCase()
    }

    const isHexString = (value) => typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value)

    const normalizeTypedDataDomain = (domain) => {
        if (!domain || typeof domain !== 'object') return domain
        const chainId = domain.chainId
        if (typeof chainId === 'string') {
            const parsed = chainId.startsWith('0x')
                ? Number.parseInt(chainId, 16)
                : Number(chainId)
            if (Number.isFinite(parsed)) {
                return { ...domain, chainId: parsed }
            }
        }
        return domain
    }

    const signRelayPayload = async (signData) => {
        if (!signData) {
            throw new Error('Missing signature payload')
        }
        if (!walletClient) {
            throw new Error('Wallet not connected')
        }

        const signatureKind = String(signData.signatureKind || '').toLowerCase()
        const account = walletClient.account || address

        if (signatureKind === 'eip191') {
            const message = signData.message
            if (!message) {
                throw new Error('Missing message to sign')
            }
            if (isHexString(message)) {
                return await walletClient.signMessage({
                    account,
                    message: { raw: message },
                })
            }
            return await walletClient.signMessage({
                account,
                message: String(message),
            })
        }

        if (signatureKind === 'eip712') {
            const domain = normalizeTypedDataDomain(signData.domain)
            const types = signData.types
            const primaryType = signData.primaryType
            const value = signData.value ?? signData.message

            if (!domain || !types || !primaryType || value === undefined) {
                throw new Error('Incomplete typed data for signature')
            }

            return await walletClient.signTypedData({
                account,
                domain,
                types,
                primaryType,
                message: value,
            })
        }

        throw new Error(`Unsupported signature kind: ${signData.signatureKind || 'unknown'}`)
    }

    const isErc20InsufficientBalance = (error) => {
        const revertData = extractRevertData(error)
        if (revertData) return true
        const text = getErrorText(error)
        return text.includes('erc20insufficientbalance') || text.includes('0xe450d38c')
    }

    const isSimulationRevert = (error) => {
        const text = getErrorText(error)
        return (
            text.includes('will revert') ||
            text.includes('execution reverted') ||
            text.includes('revert onchain') ||
            text.includes('reverted') ||
            text.includes('call exception')
        )
    }

    const getFriendlyErrorMessage = (error) => {
        if (!error) return 'An error occurred. Please try again.'

        const errorCode = error.code || error.errorCode
        if (errorCode && RELAY_ERROR_CODES[errorCode]) {
            return getRelayErrorMessage(errorCode, error.message)
        }
        const text = getErrorText(error)
        if (text.includes('no route') || text.includes('no swap route')) {
            return getRelayErrorMessage(RELAY_ERROR_CODES.NO_SWAP_ROUTES_FOUND)
        }
        if (text.includes('insufficient liquidity') || text.includes('not enough liquidity')) {
            return getRelayErrorMessage(RELAY_ERROR_CODES.INSUFFICIENT_LIQUIDITY)
        }
        if (text.includes('price impact') || text.includes('swap impact')) {
            return getRelayErrorMessage(RELAY_ERROR_CODES.SWAP_IMPACT_TOO_HIGH)
        }
        if (text.includes('amount too low') || text.includes('minimum amount')) {
            return getRelayErrorMessage(RELAY_ERROR_CODES.AMOUNT_TOO_LOW)
        }
        if (text.includes('insufficient funds') || text.includes('insufficient balance')) {
            return getRelayErrorMessage(RELAY_ERROR_CODES.INSUFFICIENT_FUNDS)
        }
        if (text.includes('unsupported currency') || text.includes('invalid currency')) {
            return getRelayErrorMessage(RELAY_ERROR_CODES.UNSUPPORTED_CURRENCY)
        }
        return error.message || 'An error occurred. Please try again.'
    }

    const getQuoteRouter = (currentQuote) => (
        currentQuote?.details?.route?.origin?.router
        || currentQuote?.details?.route?.destination?.router
        || null
    )


    const toastTimerRef = useRef(null)
    const showToast = (message) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToast(message)
        toastTimerRef.current = setTimeout(() => setToast(null), 3000)
    }

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        }
    }, [])

    const clampToDecimals = (value, maxDecimals) => {
        if (!value) return ''
        const [whole, fraction = ''] = value.split('.')
        const trimmedFraction = fraction.slice(0, maxDecimals)
        if (!trimmedFraction) return whole
        return `${whole}.${trimmedFraction}`
    }

    const getMaxTokenInput = (token) => {
        try {
            const formatted = formatUnits(BigInt(token.balance || '0'), token.decimals ?? 18)
            return clampToDecimals(formatted, 5)
        } catch {
            return ''
        }
    }

    const toggleToken = async (token) => {
        if (isBridging) return
        const blockedReason = getBlockedReason(token, sourceChain)
        if (blockedReason) {
            showToast(blockedReason)
            return
        }
        const feeReason = await detectTransferFeeReason(token, sourceChain)
        if (feeReason) {
            blockTokens([token], feeReason)
            showToast(feeReason)
            return
        }
        const newSelected = new Map(selectedTokens)
        if (newSelected.has(token.address)) {
            newSelected.delete(token.address)
        } else {
            if (newSelected.size >= MAX_BATCH_TOKENS) {
                showToast(`Maximum ${MAX_BATCH_TOKENS} tokens per batch`)
                return
            }
            const amountInput = getMaxTokenInput(token)
            newSelected.set(token.address, { token, amount: token.balance, amountInput })
        }
        setSelectedTokens(newSelected)
        setQuote(null)
    }

    const updateTokenAmount = (address, nextValue) => {
        const newSelected = new Map(selectedTokens)
        const entry = newSelected.get(address)
        if (!entry) return

        const cleaned = nextValue.replace(/[^0-9.]/g, '')
        const normalized = clampToDecimals(cleaned, 5)
        let amount = entry.amount
        let amountInput = entry.amountInput || ''

        if (normalized === '') {
            amount = '0'
            amountInput = ''
        } else {
            try {
                amount = parseUnits(normalized, entry.token.decimals ?? 18).toString()
                amountInput = normalized
            } catch {
                amount = entry.amount
                amountInput = entry.amountInput || ''
            }
        }

        try {
            const maxAmount = BigInt(entry.token.balance || '0')
            const parsedAmount = BigInt(amount || '0')
            if (parsedAmount > maxAmount) {
                amount = entry.token.balance
                amountInput = getMaxTokenInput(entry.token)
            }
        } catch {
            amount = entry.amount
            amountInput = entry.amountInput || ''
        }

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

    const handleOutputTokenSelect = async (token) => {
        const blockedReason = getBlockedReason(token, destChain)
        if (blockedReason) {
            showToast(blockedReason)
            return
        }
        const feeReason = await detectTransferFeeReason(token, destChain)
        if (feeReason) {
            markTokensBlocked([token], feeReason, destChain)
            showToast(feeReason)
            return
        }
        setOutputToken(token)
        setQuote(null)
        setExcludedSwapSources([])
        setUseFallbacks(false)
        setUseExternalLiquidity(false)
        setHoldings(prev => applyBlockedTokens(prev.map(t => ({ ...t, routeAvailable: null })), sourceChain))
    }

    const pruneSelectedTokens = (origins) => {
        if (!origins || origins.length === 0) return
        const removeSet = new Set(origins.map(origin => origin.currency.toLowerCase()))
        setSelectedTokens(prev => {
            const next = new Map()
            for (const [address, entry] of prev.entries()) {
                if (!removeSet.has(address.toLowerCase())) {
                    next.set(address, entry)
                }
            }
            return next
        })
    }

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

    const blockTokens = (tokens, reason) => {
        if (!tokens || tokens.length === 0) return
        const reasonText = reason || 'Token is not supported'
        const keys = tokens.map(token => getTokenKey(token.chainId ?? sourceChain, token.address))
        const keySet = new Set(keys)

        markTokensBlocked(tokens, reasonText)

        setHoldings(prev => prev.map(token => {
            const tokenKey = getTokenKey(token.chainId ?? sourceChain, token.address)
            if (keySet.has(tokenKey)) {
                return { ...token, routeAvailable: false, blockedReason: reasonText }
            }
            return token
        }))

        setSelectedTokens(prev => {
            const next = new Map(prev)
            for (const token of tokens) {
                next.delete(token.address)
            }
            return next
        })
    }

    const findTokensByAmount = (amount) => {
        if (amount === null || amount === undefined) return []
        const matches = []
        for (const entry of selectedTokens.values()) {
            try {
                if (BigInt(entry.amount || '0') === amount) {
                    matches.push(entry.token)
                }
            } catch {
                continue
            }
        }
        return matches
    }

    const handleAddCustomToken = async () => {
        if (!customTokenAddress.trim() || isLoadingCustomToken) return

        setIsLoadingCustomToken(true)
        try {
            const tokenData = await fetchTokenMetadata(destChain, customTokenAddress.trim())
            const feeReason = await detectTransferFeeReason(tokenData, destChain)
            if (feeReason) {
                markTokensBlocked([tokenData], feeReason, destChain)
            }

            setCustomTokens(prev => {
                const exists = prev.some(t => t.address.toLowerCase() === tokenData.address.toLowerCase())
                if (exists) return prev
                return [...prev, tokenData]
            })

            if (!feeReason) {
                await handleOutputTokenSelect(tokenData)
            }
            setCustomTokenAddress('')
            showToast(feeReason || `Added ${tokenData.symbol}`)
        } catch (error) {
            showToast(error.message || 'Failed to add token')
        } finally {
            setIsLoadingCustomToken(false)
        }
    }

    const handleAddSourceToken = async () => {
        if (!customSourceTokenAddress.trim() || isLoadingSourceToken) return
        if (!address) {
            showToast('Connect wallet first')
            return
        }

        setIsLoadingSourceToken(true)
        try {
            const tokenData = await fetchTokenMetadata(sourceChain, customSourceTokenAddress.trim())
            const balance = await fetchTokenBalance(sourceChain, tokenData.address, address)

            if (balance === '0') {
                showToast(`No ${tokenData.symbol} balance on ${getChainById(sourceChain)?.name}`)
                return
            }

            const baseToken = {
                address: tokenData.address,
                symbol: tokenData.symbol,
                name: tokenData.name,
                decimals: tokenData.decimals,
                balance,
                balanceFormatted: formatBalance(balance, tokenData.decimals),
                price: 0,
                valueUsd: 0,
                chainId: Number(sourceChain),
                logo: tokenData.logo,
                verified: true,
                routeAvailable: null,
            }

            const pricedToken = await applyRelayPriceToToken(baseToken, sourceChain)
            const feeReason = await detectTransferFeeReason(pricedToken, sourceChain)
            if (feeReason) {
                markTokensBlocked([pricedToken], feeReason, sourceChain)
            }
            const blockedReason = feeReason || getBlockedReason(pricedToken, sourceChain)
            const nextToken = blockedReason
                ? { ...pricedToken, routeAvailable: false, blockedReason }
                : pricedToken

            setHoldings(prev => {
                const exists = prev.some(t => t.address.toLowerCase() === tokenData.address.toLowerCase())
                if (exists) return prev
                return [nextToken, ...prev]
            })

            if (outputToken && !blockedReason) {
                const routeCheck = await checkRouteAvailability(
                    sourceChain,
                    destChain,
                    tokenData.address,
                    address,
                    tokenData.decimals,
                    outputToken.address
                )

                setHoldings(prev => prev.map(t => {
                    if (t.address.toLowerCase() === tokenData.address.toLowerCase()) {
                        const existingReason = t.blockedReason || getBlockedReason(t, sourceChain)
                        if (existingReason) {
                            return { ...t, routeAvailable: false, blockedReason: existingReason }
                        }
                        return { ...t, routeAvailable: routeCheck.available }
                    }
                    return t
                }))
            }

            setCustomSourceTokenAddress('')
            showToast(blockedReason || `Added ${tokenData.symbol}`)
        } catch (error) {
            showToast(error.message || 'Failed to add token')
        } finally {
            setIsLoadingSourceToken(false)
        }
    }

    const fetchQuote = async ({
        excludedSwapSourcesOverride = null,
        useFallbacksOverride = null,
        useExternalLiquidityOverride = null,
        statusMessage = 'Getting best route...',
        selectedEntriesOverride = null
    } = {}) => {
        const hasSelection = selectedEntriesOverride
            ? selectedEntriesOverride.length > 0
            : selectedTokens.size > 0
        if (!hasSelection || !outputToken || !address) return null

        const activeExcludedSources = excludedSwapSourcesOverride ?? excludedSwapSources
        const activeFallbacks = useFallbacksOverride ?? useFallbacks
        const activeExternalLiquidity = useExternalLiquidityOverride ?? useExternalLiquidity
        const explicitDeposit = walletCapabilities?.explicitDeposit ?? true

        setQuote(null)
        setIsLoadingQuote(true)
        if (statusMessage) {
            setStatus({ type: '', message: statusMessage })
        }

        try {
            let quoteResult
            let excludedOrigins = []
            let excludedHighImpactOrigins = []
            let failedOrigins = []
            let singleTokenMode = false
            const rawEntries = selectedEntriesOverride ?? Array.from(selectedTokens.values())
            const selectedEntries = rawEntries.filter(entry => {
                try {
                    return BigInt(entry.amount || '0') > 0n
                } catch {
                    return false
                }
            }).filter(entry => !getBlockedReason(entry.token, entry.token.chainId ?? sourceChain))

            if (selectedEntries.length === 0) {
                showToast('Enter an amount greater than 0')
                setStatus({ type: '', message: '' })
                return null
            }

            if (selectedEntries.length === 1) {
                const [entry] = selectedEntries
                singleTokenMode = true
                quoteResult = await getBridgeQuote({
                    user: address,
                    originChainId: sourceChain,
                    destinationChainId: destChain,
                    originCurrency: entry.token.address,
                    destinationCurrency: outputToken.address,
                    amount: entry.amount,
                    slippageTolerance: slippage,
                    recipient: address,
                    excludedSwapSources: activeExcludedSources,
                    explicitDeposit,
                    useFallbacks: activeFallbacks,
                    useExternalLiquidity: activeExternalLiquidity,
                })
            } else {
                const origins = selectedEntries.map(entry => ({
                    chainId: sourceChain,
                    currency: entry.token.address,
                    amount: entry.amount,
                    symbol: entry.token.symbol,
                }))

                const isSameChain = sourceChain === destChain

                if (isSameChain) {
                    quoteResult = await getAggregatedSwapQuotes({
                        user: address,
                        origins,
                        destinationChainId: destChain,
                        destinationCurrency: outputToken.address,
                        slippageTolerance: slippage,
                        recipient: address,
                        excludedSwapSources: activeExcludedSources,
                        explicitDeposit,
                        useFallbacks: activeFallbacks,
                        useExternalLiquidity: activeExternalLiquidity,
                    })
                    excludedHighImpactOrigins = quoteResult._excludedOrigins || []
                    failedOrigins = quoteResult._failedOrigins || []
                    excludedOrigins = [...excludedHighImpactOrigins, ...failedOrigins]
                } else {
                    const preflight = await getAggregatedSwapQuotes({
                        user: address,
                        origins,
                        destinationChainId: destChain,
                        destinationCurrency: outputToken.address,
                        slippageTolerance: slippage,
                        recipient: address,
                        excludedSwapSources: activeExcludedSources,
                        explicitDeposit,
                        useFallbacks: activeFallbacks,
                        useExternalLiquidity: activeExternalLiquidity,
                    })

                    excludedHighImpactOrigins = preflight._excludedOrigins || []
                    failedOrigins = preflight._failedOrigins || []
                    excludedOrigins = [...excludedHighImpactOrigins, ...failedOrigins]
                    const validOrigins = preflight._validOrigins || origins

                    if (validOrigins.length === 0) {
                        setStatus({
                            type: 'error',
                            message: `All selected tokens exceeded ${MAX_PRICE_IMPACT}% price impact. Try smaller amounts or different tokens.`
                        })
                        setQuote(null)
                        return null
                    }

                    if (validOrigins.length === 1) {
                        const origin = validOrigins[0]
                        singleTokenMode = true
                        quoteResult = await getBridgeQuote({
                            user: address,
                            originChainId: origin.chainId,
                            destinationChainId: destChain,
                            originCurrency: origin.currency,
                            destinationCurrency: outputToken.address,
                            amount: origin.amount,
                            slippageTolerance: slippage,
                            recipient: address,
                            excludedSwapSources: activeExcludedSources,
                            explicitDeposit,
                            useFallbacks: activeFallbacks,
                            useExternalLiquidity: activeExternalLiquidity,
                        })
                    } else {
                        quoteResult = await getMultiInputQuote({
                            user: address,
                            origins: validOrigins,
                            destinationChainId: destChain,
                            destinationCurrency: outputToken.address,
                            slippageTolerance: slippage,
                            recipient: address,
                            explicitDeposit,
                            useFallbacks: activeFallbacks,
                            useExternalLiquidity: activeExternalLiquidity,
                        })
                    }
                }
            }

            const excludedTokens = excludedOrigins.length > 0
                ? excludedOrigins.map(origin => origin.symbol || origin.currency.substring(0, 10))
                : (quoteResult?._excludedHighImpact || [])
            if (excludedTokens.length > 0) {
                if (excludedOrigins.length > 0) {
                    pruneSelectedTokens(excludedOrigins)
                }
                const highImpactTokens = excludedHighImpactOrigins.map(origin => origin.symbol || origin.currency.substring(0, 10))
                const failedTokens = failedOrigins.map(origin => origin.symbol || origin.currency.substring(0, 10))
                let message = ''
                if (highImpactTokens.length > 0) {
                    message += `⚠️ Skipped ${highImpactTokens.join(', ')} due to high price impact. `
                }
                if (failedTokens.length > 0) {
                    message += `⚠️ Skipped ${failedTokens.join(', ')} due to unsupported route.`
                }
                if (!message.trim()) {
                    message = `⚠️ Skipped ${excludedTokens.join(', ')} due to routing constraints.`
                }
                setStatus({
                    type: 'warning',
                    message: message.trim()
                })
            }

            if (singleTokenMode) {
                const priceImpact = Math.abs(parseFloat(quoteResult?.details?.totalImpact?.percent || 0))
                if (priceImpact > MAX_PRICE_IMPACT) {
                    setStatus({
                        type: 'error',
                        message: `Price impact ${priceImpact.toFixed(1)}% exceeds ${MAX_PRICE_IMPACT}%. Reduce the amount or choose another token.`
                    })
                    setQuote(null)
                    return null
                }
            }

            if (excludedTokens.length === 0) {
                setStatus({ type: 'success', message: 'Quote ready' })
            }

            try {
                quoteResult = await filterApproveStepsByAllowance(quoteResult, address)
            } catch { }

            setQuote(quoteResult)
            return quoteResult
        } catch (error) {
            setStatus({ type: 'error', message: getFriendlyErrorMessage(error) })
            setQuote(null)
            return null
        } finally {
            setIsLoadingQuote(false)
        }
    }

    const handleGetQuote = () => {
        fetchQuote()
    }

    const handleBridge = async () => {
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
            let activeChainId = connectedChainId


            const ensureChain = async (chainId) => {
                const targetChainId = Number(chainId || sourceChain)
                if (activeChainId !== targetChainId) {
                    setBridgeProgress({
                        step: 'switching',
                        message: `Switching to ${getChainById(targetChainId)?.name || 'source chain'}...`
                    })
                    await switchChainAsync({ chainId: targetChainId })
                    activeChainId = targetChainId
                }
            }

            const runSequential = async (calls) => {
                for (const call of calls) {
                    await walletClient.sendTransaction({
                        account: walletClient.account,
                        to: call.to,
                        data: call.data,
                        value: call.value,
                        gas: call.gas,
                        maxFeePerGas: call.maxFeePerGas,
                        maxPriorityFeePerGas: call.maxPriorityFeePerGas,
                    })
                }
            }

            const submitCalls = async (calls, chainId) => {
                if (!calls.length) return

                await ensureChain(chainId)

                const supportsAtomicBatch = walletCapabilities?.supportsAtomicBatch ?? true
                setBridgeProgress({
                    step: 'signing',
                    message: supportsAtomicBatch
                        ? `Sign ${calls.length} transaction(s)...`
                        : `Sign ${calls.length} transaction(s) in sequence...`
                })

                if (supportsAtomicBatch) {
                    try {
                        await sendCallsAsync({
                            chainId: Number(chainId || sourceChain),
                            calls,
                        })
                    } catch (batchError) {
                        if (isUserRejection(batchError)) {
                            throw batchError
                        }
                        const errorText = getErrorText(batchError)
                        const unsupported = errorText.includes('not supported')
                            || errorText.includes('unsupported')
                            || errorText.includes('sendcalls')
                            || errorText.includes('atomicbatch')
                        if (unsupported) {
                            await runSequential(calls)
                        } else {
                            throw batchError
                        }
                    }
                } else {
                    await runSequential(calls)
                }

                setBridgeProgress({ step: 'confirming', message: 'Waiting for confirmation...' })
            }

            const flushPendingCalls = async () => {
                if (!pendingCalls.length) return
                const callsToSend = pendingCalls
                const chainIdToUse = pendingChainId
                pendingCalls = []
                pendingChainId = null
                await submitCalls(callsToSend, chainIdToUse)
            }

            for (let i = 0; i < stepsQueue.length; i++) {
                const step = stepsQueue[i]
                if (!step?.items || step.items.length === 0) continue

                const stepKind = step.kind || (step.items.some(item => item.data?.sign) ? 'signature' : 'transaction')

                if (stepKind === 'signature') {
                    await flushPendingCalls()
                    setBridgeProgress({
                        step: 'signing',
                        message: step.description || 'Sign authorization...'
                    })

                    for (const item of step.items) {
                        const signData = item.data?.sign
                        const postData = item.data?.post
                        if (!signData || !postData) {
                            throw new Error('Missing signature data from Relay')
                        }

                        const signature = await signRelayPayload(signData)
                        const response = await submitRelaySignature({ signature, post: postData })

                        if (Array.isArray(response?.steps) && response.steps.length > 0) {
                            stepsQueue.splice(i + 1, 0, ...response.steps)
                        }

                        if (item.check?.endpoint) {
                            statusEndpoints.add(item.check.endpoint)
                        }
                    }

                    if (step.requestId) {
                        statusEndpoints.add(`/intents/status/v3?requestId=${step.requestId}`)
                    }

                    continue
                }

                if (stepKind === 'transaction') {
                    for (const item of step.items) {
                        if (item.check?.endpoint) {
                            statusEndpoints.add(item.check.endpoint)
                        }
                        if (!item.data) {
                            continue
                        }
                        const itemChainId = Number(item.data.chainId || sourceChain)

                        if (pendingChainId && pendingChainId !== itemChainId) {
                            await flushPendingCalls()
                        }
                        if (!pendingChainId) {
                            pendingChainId = itemChainId
                        }

                        pendingCalls.push({
                            to: item.data.to,
                            data: item.data.data,
                            value: BigInt(item.data.value || '0'),
                            gas: item.data.gas ? BigInt(item.data.gas) : undefined,
                            maxFeePerGas: item.data.maxFeePerGas ? BigInt(item.data.maxFeePerGas) : undefined,
                            maxPriorityFeePerGas: item.data.maxPriorityFeePerGas ? BigInt(item.data.maxPriorityFeePerGas) : undefined,
                        })


                    }

                    if (step.requestId) {
                        statusEndpoints.add(`/intents/status/v3?requestId=${step.requestId}`)
                    }
                }
            }

            await flushPendingCalls()

            if (Array.isArray(quote.requestIds)) {
                for (const requestId of quote.requestIds) {
                    statusEndpoints.add(`/intents/status/v3?requestId=${requestId}`)
                }
            }

            if (statusEndpoints.size > 0) {
                setBridgeProgress({ step: 'polling', message: `Waiting for ${statusEndpoints.size} swap(s)...` })

                const results = await Promise.all(
                    Array.from(statusEndpoints).map(endpoint => pollBridgeStatus(endpoint))
                )

                const failedResults = results.filter(result => !result.success)
                const allSuccess = failedResults.length === 0
                if (allSuccess) {
                    setBridgeProgress({ step: 'complete', message: 'All swaps complete!' })
                    setStatus({ type: 'success', message: 'Tokens swapped successfully!' })
                    setSuccessPanel({
                        title: 'Bridge complete',
                        message: '',
                    })
                    setBridgePanelMode('success')
                    shouldReset = false
                } else {
                    const terminalFailures = new Set(['failure', 'failed', 'reverted', 'refund', 'refunded'])
                    const failureStatusValues = failedResults
                        .map(result => String(result.status?.status || '').toLowerCase())
                        .filter(Boolean)
                    const hasTerminalFailure = failureStatusValues.some(statusValue => terminalFailures.has(statusValue))
                    const failureMessage = failedResults.find(result => result.error)?.error
                        || (hasTerminalFailure ? 'Bridge failed or refunded.' : 'Bridge is still pending.')

                    setBridgeProgress({ step: 'complete', message: hasTerminalFailure ? 'Bridge failed' : 'Bridge pending' })
                    setStatus({
                        type: hasTerminalFailure ? 'error' : 'warning',
                        message: `${failureMessage} Check your wallet or Relay status for updates.`
                    })
                    setSuccessPanel(null)
                    setBridgePanelMode('idle')
                }
                skipNextHoldingsRefreshRef.current = true
            } else {
                setBridgeProgress({ step: 'complete', message: 'Transaction complete!' })
                setStatus({ type: 'success', message: 'Transaction complete!' })
                skipNextHoldingsRefreshRef.current = true
            }
        } catch (error) {
            if (isUserRejection(error)) {
                setStatus({ type: '', message: 'Transaction cancelled' })
                shouldReset = false
                skipNextHoldingsRefreshRef.current = true
                setBridgePanelMode('idle')
            } else if (isErc20InsufficientBalance(error) || isSimulationRevert(error)) {
                const insufficientInfo = parseErc20InsufficientBalance(error)
                const ratioBps = insufficientInfo?.ratioBps
                const ratioPercent = ratioBps !== null && ratioBps !== undefined ? Number(ratioBps) / 100 : null
                const feePercent = ratioPercent !== null ? Math.max(0, 100 - ratioPercent) : null
                const selectedEntries = Array.from(selectedTokens.values()).filter(entry => {
                    try {
                        return BigInt(entry.amount || '0') > 0n
                    } catch {
                        return false
                    }
                })
                const isUserBalance = insufficientInfo?.address
                    && address
                    && insufficientInfo.address.toLowerCase() === address.toLowerCase()
                const isFeeOnTransfer = ratioPercent !== null && ratioPercent < 99.99

                const isMagpieRoute = sourceChain === destChain
                    && String(getQuoteRouter(quote) || '').toLowerCase() === 'magpie'

                if (isUserBalance) {
                    shouldReset = false
                    setStatus({ type: 'error', message: 'Insufficient token balance for this swap.' })
                    setBridgePanelMode('idle')
                } else if (isFeeOnTransfer) {
                    shouldReset = false
                    let suspectTokens = findTokensByAmount(insufficientInfo?.needed)
                    if (suspectTokens.length === 0 && selectedEntries.length === 1) {
                        suspectTokens = [selectedEntries[0].token]
                    }

                    if (suspectTokens.length > 0) {
                        const tokenLabels = suspectTokens.map(token => token.symbol || token.address.substring(0, 8)).join(', ')
                        const feeHint = feePercent !== null ? ` (~${feePercent.toFixed(2)}%)` : ''
                        const reason = 'Transfer-fee token (unsupported)'
                        const suspectSet = new Set(suspectTokens.map(token => token.address.toLowerCase()))
                        const remainingEntries = selectedEntries.filter(entry => !suspectSet.has(entry.token.address.toLowerCase()))

                        blockTokens(suspectTokens, reason)
                        skipNextHoldingsRefreshRef.current = true
                        setBridgePanelMode('idle')

                        if (remainingEntries.length > 0) {
                            setStatus({ type: 'warning', message: `Skipped ${tokenLabels} due to transfer fees${feeHint}. Requoting remaining tokens...` })
                            await fetchQuote({
                                selectedEntriesOverride: remainingEntries,
                                statusMessage: 'Re-quoting remaining tokens...'
                            })
                        } else {
                            setStatus({ type: 'error', message: `${tokenLabels} charge transfer fees${feeHint} and are not supported by this route.` })
                            setQuote(null)
                        }
                    } else {
                        setStatus({
                            type: 'error',
                            message: 'Transfer-fee token detected. Try a different token.'
                        })
                        setBridgePanelMode('idle')
                    }
                } else if (isMagpieRoute && !excludedSwapSources.some(source => source.toLowerCase() === 'magpie')) {
                    shouldReset = false
                    skipNextHoldingsRefreshRef.current = true
                    setBridgePanelMode('idle')
                    const nextExcluded = [...excludedSwapSources, 'magpie']
                    setExcludedSwapSources(nextExcluded)
                    setStatus({ type: 'warning', message: 'Route ran out of liquidity. Trying alternative sources...' })
                    const altQuote = await fetchQuote({
                        excludedSwapSourcesOverride: nextExcluded,
                        statusMessage: 'Trying an alternative route...'
                    })
                    if (!altQuote) {
                        setStatus({ type: 'error', message: 'No alternative route available. Try a smaller amount or a different token.' })
                    }
                } else if (!useFallbacks) {
                    shouldReset = false
                    skipNextHoldingsRefreshRef.current = true
                    setBridgePanelMode('idle')
                    setUseFallbacks(true)
                    setStatus({ type: 'warning', message: 'Swap failed on route. Retrying with fallback sources...' })
                    const altQuote = await fetchQuote({
                        useFallbacksOverride: true,
                        statusMessage: 'Searching fallback routes...'
                    })
                    if (!altQuote) {
                        setStatus({ type: 'error', message: 'No fallback route available. Try a smaller amount or a different token.' })
                    }
                } else if (!useExternalLiquidity) {
                    shouldReset = false
                    skipNextHoldingsRefreshRef.current = true
                    setBridgePanelMode('idle')
                    setUseExternalLiquidity(true)
                    setStatus({ type: 'warning', message: 'Retrying with external liquidity routing...' })
                    const altQuote = await fetchQuote({
                        useFallbacksOverride: true,
                        useExternalLiquidityOverride: true,
                        statusMessage: 'Searching external liquidity routes...'
                    })
                    if (!altQuote) {
                        setStatus({ type: 'error', message: 'No external liquidity route available. Try a smaller amount or a different token.' })
                    }
                } else {
                    const feeHint = feePercent !== null
                        ? `Token transfer fee detected (~${feePercent.toFixed(2)}%).`
                        : 'Swap simulation reverted on this route.'
                    setStatus({
                        type: 'error',
                        message: `${feeHint} This route cannot execute the swap. Try a different token or swap source.`
                    })
                    setBridgePanelMode('idle')
                }
            } else {
                setStatus({ type: 'error', message: getFriendlyErrorMessage(error) })
                setBridgePanelMode('idle')
            }
        } finally {
            setIsBridging(false)
            setBridgeProgress(null)
            if (shouldReset) {
                setQuote(null)
                setSelectedTokens(new Map())
            }
            resetBatchCalls()
        }
    }


    const activeSelectionCount = Array.from(selectedTokens.values()).reduce((count, entry) => {
        try {
            return count + (BigInt(entry.amount || '0') > 0n ? 1 : 0)
        } catch {
            return count
        }
    }, 0)

    const selectedTotal = Array.from(selectedTokens.values()).reduce((sum, entry) => {
        const amountValue = Number(entry.amountInput || 0)
        if (Number.isFinite(amountValue) && entry.token.price) {
            return sum + (amountValue * entry.token.price)
        }
        return sum + (entry.token.valueUsd || 0)
    }, 0)

    const getOutputAmount = () => {
        if (!quote?.details?.currencyOut) return null
        const out = quote.details.currencyOut
        return {
            amount: out.amountFormatted,
            usd: out.amountUsd,
        }
    }

    const getFees = () => {
        if (!quote?.fees) return null
        const { gas, relayer } = quote.fees
        return {
            gas: gas?.amountUsd || '0',
            relay: relayer?.amountUsd || '0',
            total: (parseFloat(gas?.amountUsd || 0) + parseFloat(relayer?.amountUsd || 0)).toFixed(2),
        }
    }

    const outputTokens = COMMON_TOKENS[destChain] || []

    return (
        <div className={`app-container ${isConnected ? 'connected' : ''}`}>
            <nav className="navbar">
                <div className="logo">
                    <div className="logo-dot"></div>
                    <span className="logo-text">batch—bridge</span>
                </div>
                <div className="nav-connect">
                    {!isConnected ? (
                        <button
                            className="connect-btn"
                            onClick={() => {
                                open()
                            }}
                        >
                            Connect Wallet
                        </button>
                    ) : (
                        <div className="connected-buttons">
                            <button className="chain-btn" onClick={() => open({ view: 'Networks' })}>
                                {getChainById(connectedChainId)?.name || 'Unknown'}
                            </button>
                            <button className="account-btn" onClick={() => disconnect()}>
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            <main className="main-content">
                {/* --- SEKCOJA SEO DLA BING/GOOGLE --- */}
<header className="page-seo-header">
    <h1 className="seo-title">
        Batch Bridge: Atomic Multi-Token Cross-Chain Transfers
    </h1>
    <p className="seo-subtitle">
        Securely bridge and swap multiple assets across Ethereum, Base, Arbitrum, and more in a single transaction.
    </p>
</header>
{/* --- KONIEC SEKCOJI SEO --- */}
                {!isConnected ? (
                    <div className="hero">
                        <div className="hero-text">
                            <div className="hero-text-zone">
                                <h1 className="hero-title">Bridge tokens across chains</h1>
                                <p className="hero-subtitle">
                                    Select multiple tokens and bridge them in a single transaction
                                </p>
                            </div>
                            <div className="hero-button-zone">
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        open()
                                    }}
                                >
                                    START BRIDGING
                                </button>
                            </div>
                        </div>
                        <div className="hero-visual">
                            <div className="hero-chains">
                                {BRIDGE_CHAINS.map((chain, i) => (
                                    <div key={chain.id} className="hero-chain-pill" style={{ '--chain-color': chain.color, '--delay': `${i * 0.1}s` }}>
                                        <img src={chain.logo} alt={chain.name} className="chain-logo-small" />
                                        {chain.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bridge-container">
                        <div className="chain-selector-row">
                            <div className="chain-selector">
                                <label>From</label>
                                <div className="chain-options">
                                    {BRIDGE_CHAINS.map(chain => (
                                        <button
                                            key={chain.id}
                                            className={`chain-option ${sourceChain === chain.id ? 'active' : ''}`}
                                            style={{ '--chain-color': chain.color }}
                                            onClick={() => {
                                                if (chain.id !== sourceChain) {
                                                    setSourceChain(chain.id)
                                                    setSelectedTokens(new Map())
                                                    setQuote(null)
                                                    setExcludedSwapSources([])
                                                }
                                            }}
                                        >
                                            <img src={chain.logo} alt={chain.name} className="chain-logo" onError={(e) => { e.target.style.display = 'none' }} />
                                            <span>{chain.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button className="swap-chains-btn" onClick={handleSwapChains}>
                                <SwapIcon />
                            </button>

                            <div className="chain-selector">
                                <label>To</label>
                                <div className="chain-options">
                                    {BRIDGE_CHAINS.map(chain => (
                                        <button
                                            key={chain.id}
                                            className={`chain-option ${destChain === chain.id ? 'active' : ''}`}
                                            style={{ '--chain-color': chain.color }}
                                            onClick={() => {
                                                if (chain.id !== destChain) {
                                                    setDestChain(chain.id)
                                                    setOutputToken(null)
                                                    setCustomTokens([])
                                                    setQuote(null)
                                                    setExcludedSwapSources([])
                                                }
                                            }}
                                        >
                                            <img src={chain.logo} alt={chain.name} className="chain-logo" onError={(e) => { e.target.style.display = 'none' }} />
                                            <span>{chain.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bridge-panels">
                            <div className="token-panel output-panel">
                                <div className="panel-header">
                                    <h3>Receive As</h3>
                                </div>
                                <div className="token-list output-tokens scrollbar-hidden">
                                    {outputTokens.map(token => (
                                        <div
                                            key={token.address}
                                            className={`token-item ${outputToken?.address === token.address ? 'selected' : ''}`}
                                            onClick={() => handleOutputTokenSelect(token)}
                                        >
                                            <div className="token-info">
                                                <div className="token-icon">
                                                    {token.logo ? (
                                                        <img
                                                            src={token.logo}
                                                            alt={token.symbol}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span className="token-icon-fallback" style={{ display: token.logo ? 'none' : 'flex' }}>
                                                        {token.symbol.charAt(0)}
                                                    </span>
                                                </div>
                                                <div className="token-details">
                                                    <span className="token-symbol">{token.symbol}</span>
                                                    <span className="token-name">{token.name}</span>
                                                </div>
                                            </div>
                                            <div className="token-checkbox">
                                                {outputToken?.address === token.address && <CheckIcon />}
                                            </div>
                                        </div>
                                    ))}
                                    {customTokens.map(token => (
                                        <div
                                            key={token.address}
                                            className={`token-item custom-token ${outputToken?.address === token.address ? 'selected' : ''}`}
                                            onClick={() => handleOutputTokenSelect(token)}
                                        >
                                            <div className="token-info">
                                                <div className="token-icon">
                                                    {token.logo ? (
                                                        <img
                                                            src={token.logo}
                                                            alt={token.symbol}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span className="token-icon-fallback" style={{ display: token.logo ? 'none' : 'flex' }}>
                                                        {token.symbol.charAt(0)}
                                                    </span>
                                                </div>
                                                <div className="token-details">
                                                    <span className="token-symbol">{token.symbol}</span>
                                                    <span className="token-name">{token.name}</span>
                                                </div>
                                            </div>
                                            <div className="token-checkbox">
                                                {outputToken?.address === token.address && <CheckIcon />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="custom-token-input">
                                    <input
                                        type="text"
                                        placeholder="Add custom output token (0x...)"
                                        value={customTokenAddress}
                                        onChange={(e) => setCustomTokenAddress(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomToken()}
                                        disabled={isLoadingCustomToken}
                                    />
                                    <button
                                        onClick={handleAddCustomToken}
                                        disabled={!customTokenAddress.trim() || isLoadingCustomToken}
                                    >
                                        {isLoadingCustomToken ? <LoaderIcon /> : '+'}
                                    </button>
                                </div>
                            </div>
                            <div className="token-panel">
                                <div className="panel-header">
                                    <h3>Select Tokens to Bridge</h3>
                                    <button
                                        className="refresh-btn"
                                        onClick={loadHoldings}
                                        disabled={isLoadingHoldings}
                                    >
                                        {isLoadingHoldings ? 'Loading...' : 'Refresh'}
                                    </button>
                                </div>
                                {!outputToken && (
                                    <div className="route-hint">
                                        <span>Select a “Receive As” token to check routes</span>
                                    </div>
                                )}
                                <div className="token-list scrollbar-hidden">
                                    {isLoadingHoldings ? (
                                        <div className="loading-tokens">
                                            <LoaderIcon />
                                            <span>Loading tokens...</span>
                                        </div>
                                    ) : holdings.length === 0 ? (
                                        <div className="empty-tokens">
                                            <p>No tokens found on {getChainById(sourceChain)?.name}</p>
                                        </div>
                                    ) : (
                                        holdings.map(token => {
                                            const selectedEntry = selectedTokens.get(token.address)
                                            const amountValue = selectedEntry ? Number(selectedEntry.amountInput || 0) : null
                                            const displayValueUsd = selectedEntry && Number.isFinite(amountValue)
                                                ? (amountValue * (token.price || 0))
                                                : token.valueUsd
                                            const blockedReason = getBlockedReason(token, sourceChain)
                                            const isBlocked = Boolean(blockedReason)
                                            const isUnavailable = token.routeAvailable === false || isBlocked

                                            return (
                                                <div
                                                    key={token.address}
                                                    className={`token-item ${selectedTokens.has(token.address) ? 'selected' : ''} ${isUnavailable ? 'unavailable' : ''} ${isCheckingRoutes ? 'disabled' : ''}`}
                                                    onClick={() => {
                                                        if (isCheckingRoutes) return;
                                                        if (!outputToken) {
                                                            showToast('Select output token first');
                                                            return;
                                                        }
                                                        if (isBlocked) {
                                                            showToast(blockedReason)
                                                            return
                                                        }
                                                        if (token.routeAvailable === false) return;
                                                        toggleToken(token);
                                                    }}
                                                >
                                                    <div className="token-info">
                                                        <div className="token-icon">
                                                            {token.logo ? (
                                                                <img
                                                                    src={token.logo}
                                                                    alt={token.symbol}
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <span className="token-icon-fallback" style={{ display: token.logo ? 'none' : 'flex' }}>
                                                                {token.symbol.charAt(0)}
                                                            </span>
                                                        </div>
                                                        <div className="token-details">
                                                            <span className="token-symbol">{token.symbol}</span>
                                                            <span className="token-balance">{token.balanceFormatted}</span>
                                                        </div>
                                                    </div>
                                                    <div className="token-value">
                                                        {isBlocked ? (
                                                            <span className="no-route-badge">{blockedReason}</span>
                                                        ) : token.routeAvailable === false ? (
                                                            <span className="no-route-badge">No route to {outputToken?.symbol || getChainById(destChain)?.name}</span>
                                                        ) : (
                                                            formatUsd(displayValueUsd)
                                                        )}
                                                    </div>
                                                    {selectedEntry && (
                                                        <div className="token-amount" onClick={(event) => event.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                placeholder="0.00000"
                                                                value={selectedEntry.amountInput || ''}
                                                                onChange={(event) => updateTokenAmount(token.address, event.target.value)}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setMaxAmount(token.address)}
                                                            >
                                                                Max
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="token-checkbox">
                                                        {selectedTokens.has(token.address) && <CheckIcon />}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                                <div className="custom-token-input source-token-input">
                                    <input
                                        type="text"
                                        placeholder="Add token by address (0x...)"
                                        value={customSourceTokenAddress}
                                        onChange={(e) => setCustomSourceTokenAddress(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSourceToken()}
                                        disabled={isLoadingSourceToken}
                                    />
                                    <button
                                        onClick={handleAddSourceToken}
                                        disabled={!customSourceTokenAddress.trim() || isLoadingSourceToken}
                                    >
                                        {isLoadingSourceToken ? <LoaderIcon /> : '+'}
                                    </button>
                                </div>
                                {activeSelectionCount > 0 && (
                                    <div className="panel-footer">
                                        <span>{activeSelectionCount} token{activeSelectionCount > 1 ? 's' : ''} selected</span>
                                        <span className="total-value">{formatUsd(selectedTotal)}</span>
                                    </div>
                                )}
                            </div>

                        </div>

                        <div
                            className={`bridge-actions ${bridgePanelMode !== 'idle' ? 'panel-shifted' : ''}`}
                        >
                            <div className="bridge-actions-panels">
                                <div className="bridge-panel bridge-panel-main">
                                    <div className="slippage-settings">
                                        <label>Slippage Tolerance</label>
                                        <div className="slippage-options">
                                            {SLIPPAGE_PRESETS.map(preset => (
                                                <button
                                                    key={preset.label}
                                                    className={`slippage-btn ${slippage === preset.value && !customSlippage ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setSlippage(preset.value)
                                                        setCustomSlippage('')
                                                    }}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                            <div className="custom-slippage">
                                                <input
                                                    type="number"
                                                    placeholder="Custom"
                                                    value={customSlippage}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setCustomSlippage(val)
                                                        if (!val) {
                                                            setSlippage(null)
                                                            return
                                                        }
                                                        const parsed = Number(val)
                                                        if (Number.isFinite(parsed)) {
                                                            const clamped = Math.min(Math.max(parsed, 0.01), 50)
                                                            setSlippage(Math.round(clamped * 100))
                                                        }
                                                    }}
                                                    min="0.01"
                                                    max="50"
                                                    step="0.1"
                                                />
                                                <span className="slippage-suffix">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {quote && (
                                        <div className="quote-display">
                                            <div className="quote-row">
                                                <span>You receive</span>
                                                <span className="quote-value">
                                                    {getOutputAmount()?.amount} {outputToken?.symbol}
                                                    <span className="quote-usd">(~${getOutputAmount()?.usd})</span>
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
                                                    <span>Estimated time</span>
                                                    <span>~{quote.details.timeEstimate}s</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {bridgePanelMode === 'idle' && status.message && (
                                        <div className={`status-message ${status.type}`}>
                                            {status.message}
                                        </div>
                                    )}

                                    {bridgePanelMode === 'idle' && bridgeProgress && (
                                        <div className="bridge-progress">
                                            <LoaderIcon />
                                            <span>{bridgeProgress.message}</span>
                                        </div>
                                    )}

                                    <div className="action-buttons">
                                        {!quote ? (
                                            <>
                                                <button
                                                    className="btn-primary btn-large"
                                                    onClick={handleGetQuote}
                                                    disabled={activeSelectionCount === 0 || selectedTokens.size > MAX_BATCH_TOKENS || !outputToken || isLoadingQuote}
                                                >
                                                    {isLoadingQuote ? 'Getting Quote...' : 'Get Quote'}
                                                </button>
                                                {selectedTokens.size > MAX_BATCH_TOKENS && (
                                                    <p className="batch-limit-warning">
                                                        ⚠️ Maximum {MAX_BATCH_TOKENS} tokens per batch. Selected: {selectedTokens.size}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <button
                                                className="btn-primary btn-large btn-bridge"
                                                onClick={handleBridge}
                                                disabled={isBridging}
                                            >
                                                {isBridging ? 'Bridging...' : `Bridge ${activeSelectionCount} Token${activeSelectionCount > 1 ? 's' : ''}`}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="bridge-panel bridge-panel-status">
                                    {bridgePanelMode === 'success' && (
                                        <button className="status-close" onClick={handleCloseBridgePanel} aria-label="Close">
                                            ×
                                        </button>
                                    )}
                                    {bridgePanelMode === 'processing' && (
                                        <>
                                            <div className="bridge-status-icon processing">
                                                <LoaderIcon />
                                            </div>
                                            <div className="bridge-status-title">Processing</div>
                                            <div className="bridge-status-message">
                                                {bridgeProgress?.message || 'Processing your bridge...'}
                                            </div>
                                        </>
                                    )}
                                    {bridgePanelMode === 'success' && (
                                        <>
                                            <div className="bridge-status-icon success">
                                                <CheckIcon />
                                            </div>
                                            <div className="bridge-status-title">{successPanel?.title || 'Bridge complete'}</div>
                                            {successPanel?.message ? (
                                                <div className="bridge-status-message">
                                                    {successPanel.message}
                                                </div>
                                            ) : null}
                                            <button className="bridge-status-action" onClick={handleBridgeAgain}>
                                                Bridge again
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="footer">
                Built with <a href="https://relay.link" target="_blank" rel="noopener noreferrer">Relay Protocol</a> • Data by <a href="https://routescan.io" target="_blank" rel="noopener noreferrer">Routescan</a>
            </footer>

            {isCheckingRoutes && (
                <div className="route-check-overlay" role="status" aria-live="polite">
                    <div className="route-check-card">
                        <LoaderIcon />
                        <div className="route-check-title">Checking routes</div>
                        <div className="route-check-subtitle">
                            Finding the best path to {outputToken?.symbol || 'your selected token'}...
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="toast-notification">
                    <span className="toast-icon">ℹ</span>
                    <span className="toast-text">{toast}</span>
                </div>
            )}

            <SpeedInsights />
            <Analytics />
        </div>
    )
}
