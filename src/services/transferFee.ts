import { createPublicClient, http } from 'viem'
import { getChainConfig } from '../config/chains'

const TRANSFER_FEE_FUNCTIONS = [
    'transferFee',
    'transferFeeBps',
    'transferFeeBP',
    'transferFeeBasisPoints',
] as const
const TRANSFER_FEE_ABI = TRANSFER_FEE_FUNCTIONS.map((name) => ({
    name,
    type: 'function' as const,
    stateMutability: 'view' as const,
    inputs: [],
    outputs: [{ type: 'uint256' }],
}))
const KNOWN_TRANSFER_FEE_TOKENS: Record<number, Record<string, number>> = {
    8453: {
        '0xfb42da273158b0f642f59f2ba7cc1d5457481677': 125,
    },
}
const transferFeeCache = new Map<string, boolean>()
const MAX_TRANSFER_FEE_CACHE_SIZE = 500

const setTransferFeeCache = (key: string, value: boolean) => {
    transferFeeCache.set(key, value)
    if (transferFeeCache.size > MAX_TRANSFER_FEE_CACHE_SIZE) {
        const oldestKey = transferFeeCache.keys().next().value
        if (oldestKey !== undefined) transferFeeCache.delete(oldestKey)
    }
}

/**
 * Not currently wired into Swap/Bridge cards - the old App.tsx called this
 * before letting a token be selected, warning about fee-on-transfer tokens
 * (which silently short the amount actually received and can make a quote's
 * execution revert). That call site was deleted along with the rest of
 * legacy App.tsx in Task 36. Kept here, on the 16-chain config (unlike the
 * bridgeService.ts-era 3-chain client this replaces), as a known gap: the
 * detection logic still works, it's just not surfaced to the user anywhere
 * yet.
 */
const getPublicClient = (chainId: number) => {
    const chainConfig = getChainConfig(chainId)
    if (!chainConfig) throw new Error(`Unsupported chain ID: ${chainId}`)

    return createPublicClient({
        transport: http(chainConfig.rpcUrls[0], { batch: true }),
        batch: {
            multicall: true,
        },
    })
}

export const detectTransferFeeToken = async (chainId: number, tokenAddress: string): Promise<boolean> => {
    if (!tokenAddress) return false
    const normalizedAddress = tokenAddress.toLowerCase()
    if (normalizedAddress === '0x0000000000000000000000000000000000000000') return false
    const chainNumeric = Number(chainId)
    if (!Number.isFinite(chainNumeric)) return false

    const cacheKey = `${chainNumeric}-${normalizedAddress}`
    if (transferFeeCache.has(cacheKey)) {
        return transferFeeCache.get(cacheKey)!
    }

    const knownFee = KNOWN_TRANSFER_FEE_TOKENS[chainNumeric]?.[normalizedAddress]
    if (knownFee !== undefined) {
        const isFee = Number(knownFee) > 0
        setTransferFeeCache(cacheKey, isFee)
        return isFee
    }

    const publicClient = getPublicClient(chainNumeric)

    const contracts = TRANSFER_FEE_FUNCTIONS.map((functionName) => ({
        address: tokenAddress as `0x${string}`,
        abi: TRANSFER_FEE_ABI,
        functionName,
    }))

    let isFee = false
    try {
        const results = await publicClient.multicall({
            contracts,
            allowFailure: true,
        })

        for (const result of results) {
            if (result.status === 'success' && result.result !== undefined && result.result !== null) {
                const feeValue = BigInt(result.result as unknown as bigint)
                if (feeValue > 0n) {
                    isFee = true
                    break
                }
            }
        }
    } catch {
        // Multicall failed (unsupported chain/RPC hiccup) - treat as "not a fee token" rather than blocking selection.
    }

    setTransferFeeCache(cacheKey, isFee)
    return isFee
}

export const detectTransferFeeTokensBatch = async (
    chainId: number,
    tokenAddresses: string[],
): Promise<Map<string, boolean>> => {
    if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) return new Map()
    const chainNumeric = Number(chainId)
    if (!Number.isFinite(chainNumeric)) return new Map()

    const results = new Map<string, boolean>()
    const uncached: string[] = []

    for (const tokenAddress of tokenAddresses) {
        if (!tokenAddress) continue
        const normalizedAddress = tokenAddress.toLowerCase()
        if (normalizedAddress === '0x0000000000000000000000000000000000000000') {
            results.set(normalizedAddress, false)
            continue
        }

        const cacheKey = `${chainNumeric}-${normalizedAddress}`
        if (transferFeeCache.has(cacheKey)) {
            results.set(normalizedAddress, transferFeeCache.get(cacheKey)!)
            continue
        }

        const knownFee = KNOWN_TRANSFER_FEE_TOKENS[chainNumeric]?.[normalizedAddress]
        if (knownFee !== undefined) {
            const isFee = Number(knownFee) > 0
            setTransferFeeCache(cacheKey, isFee)
            results.set(normalizedAddress, isFee)
            continue
        }

        uncached.push(normalizedAddress)
    }

    if (uncached.length === 0) return results

    const publicClient = getPublicClient(chainNumeric)

    const contracts = uncached.flatMap((tokenAddress) =>
        TRANSFER_FEE_FUNCTIONS.map((functionName) => ({
            address: tokenAddress as `0x${string}`,
            abi: TRANSFER_FEE_ABI,
            functionName,
        })),
    )

    try {
        const multicallResults = await publicClient.multicall({
            contracts,
            allowFailure: true,
        })

        const functionsCount = TRANSFER_FEE_FUNCTIONS.length
        for (let i = 0; i < uncached.length; i++) {
            const tokenAddress = uncached[i]
            const startIdx = i * functionsCount
            let isFee = false

            for (let j = 0; j < functionsCount; j++) {
                const result = multicallResults[startIdx + j]
                if (result.status === 'success' && result.result !== undefined && result.result !== null) {
                    const feeValue = BigInt(result.result as unknown as bigint)
                    if (feeValue > 0n) {
                        isFee = true
                        break
                    }
                }
            }

            const cacheKey = `${chainNumeric}-${tokenAddress}`
            setTransferFeeCache(cacheKey, isFee)
            results.set(tokenAddress, isFee)
        }
    } catch {
        // On error, mark all uncached as non-fee tokens rather than blocking selection.
        for (const tokenAddress of uncached) {
            const cacheKey = `${chainNumeric}-${tokenAddress}`
            setTransferFeeCache(cacheKey, false)
            results.set(tokenAddress, false)
        }
    }

    return results
}
