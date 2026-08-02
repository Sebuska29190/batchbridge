import { createPublicClient, http, erc20Abi } from 'viem'
import { getChainConfig } from '../config/chains'

const RELAY_API_BASE = 'https://api.relay.link'

/**
 * Reads on-chain ERC-20 allowance. Uses the 16-chain config (unlike the
 * legacy 3-chain getPublicClient the old bridgeService.ts used before it was
 * deleted in Task 36/40) since this is execution-layer code meant to work
 * across all configured chains, not just an original 3.
 */
export const checkTokenAllowance = async (
    chainId: number,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string | undefined,
): Promise<bigint> => {
    try {
        if (!spenderAddress) return BigInt(0)

        const chainConfig = getChainConfig(chainId)
        if (!chainConfig) return BigInt(0)

        const client = createPublicClient({ transport: http(chainConfig.rpcUrls[0]) })
        const allowance = await (client.readContract as any)({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [ownerAddress, spenderAddress],
        })

        return allowance
    } catch {
        return BigInt(0)
    }
}

interface RelayErrorData {
    message?: string
    errorCode?: string
    errorData?: unknown
    requestId?: string
}

export const buildRelayError = async (response: Response, fallbackMessage: string): Promise<Error> => {
    let data: RelayErrorData = {}
    try {
        data = await response.json()
    } catch {
        data = {}
    }

    const message = data.message || fallbackMessage
    const error = new Error(message) as Error & { code?: string; errorData?: unknown; requestId?: string }
    if (data.errorCode) error.code = data.errorCode
    if (data.errorData) error.errorData = data.errorData
    if (data.requestId) error.requestId = data.requestId
    return error
}

const normalizeStatusEndpoint = (endpointOrRequestId: string): string | null => {
    if (!endpointOrRequestId) return null
    if (endpointOrRequestId.startsWith('http')) return endpointOrRequestId
    if (endpointOrRequestId.startsWith('/')) {
        return `${RELAY_API_BASE}${endpointOrRequestId}`
    }
    return `${RELAY_API_BASE}/intents/status/v3?requestId=${endpointOrRequestId}`
}

interface BridgeStatusResult {
    success: boolean
    status?: unknown
    error?: string
}

/**
 * Polls Relay for cross-chain bridge status until success/failure or
 * maxAttempts is reached. Ported from bridgeService.js unchanged.
 */
export const pollBridgeStatus = async (
    endpointOrRequestId: string,
    maxAttempts = 60,
    intervalMs = 2000,
): Promise<BridgeStatusResult> => {
    const statusUrl = normalizeStatusEndpoint(endpointOrRequestId)
    if (!statusUrl) {
        return { success: false, error: 'Missing status endpoint' }
    }

    let lastStatus: { status?: string } | null = null
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(statusUrl)

            if (!response.ok) {
                await new Promise((r) => setTimeout(r, intervalMs))
                continue
            }

            const status = await response.json()
            lastStatus = status

            const statusValue = (status.status || '').toLowerCase()
            if (statusValue === 'success' || statusValue === 'confirmed') {
                return { success: true, status }
            }

            if (['failure', 'failed', 'reverted', 'refund', 'refunded', 'fallback'].includes(statusValue)) {
                return { success: false, status, error: 'Bridge transaction failed' }
            }

            await new Promise((r) => setTimeout(r, intervalMs))
        } catch {
            await new Promise((r) => setTimeout(r, intervalMs))
        }
    }

    if (lastStatus) {
        const statusValue = (lastStatus.status || 'unknown').toLowerCase()
        return {
            success: false,
            status: lastStatus,
            error: `Bridge still ${statusValue} after waiting`,
        }
    }

    return { success: false, error: 'Timeout waiting for bridge confirmation' }
}

interface RejectableError {
    message?: string
    shortMessage?: string
    code?: string | number
}

/** True if the error looks like the user rejected/cancelled a wallet prompt, not a real failure. Takes `unknown` since it's always called from a `catch` block. */
export const isUserRejection = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    const { message, shortMessage, code } = error as RejectableError
    const combined = (message || shortMessage || '').toLowerCase()
    const revertHint = combined.includes('revert') || combined.includes('reverted') ||
        combined.includes('execution reverted') || combined.includes('simulation')
    if ((code === 4001 || code === 'ACTION_REJECTED') && !revertHint) {
        return true
    }
    return combined.includes('rejected') || combined.includes('denied') ||
        combined.includes('cancelled') || combined.includes('canceled') ||
        combined.includes('user refused') || combined.includes('user declined') ||
        combined.includes('user closed') || combined.includes('user rejected')
}
