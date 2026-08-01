import { createPublicClient, http, erc20Abi } from 'viem'
import { getChainConfig } from '../config/chains'

const RELAY_API_BASE = 'https://api.relay.link'
const APPROVE_SELECTOR = '0x095ea7b3'

/**
 * Reads on-chain ERC-20 allowance. Uses the 16-chain config (unlike the
 * legacy 3-chain getPublicClient still living in bridgeService.ts) since
 * this is new execution-layer code meant to work across all configured
 * chains, not just the original 3.
 */
export const checkTokenAllowance = async (
    chainId,
    tokenAddress,
    ownerAddress,
    spenderAddress
) => {
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

const parseApproveData = (calldata) => {
    if (!calldata) return null
    const normalized = calldata.toLowerCase()
    if (!normalized.startsWith(APPROVE_SELECTOR)) return null
    const payload = normalized.slice(10)
    if (payload.length < 128) return null
    const spenderChunk = payload.slice(0, 64)
    const amountChunk = payload.slice(64, 128)
    const spender = `0x${spenderChunk.slice(24)}`
    const amount = BigInt(`0x${amountChunk}`)
    return { spender, amount }
}

const isApprovalStepId = (stepId) => stepId === 'approve' || stepId === 'approval'

/**
 * Drops approve steps from a quote's step list when the owner already has
 * sufficient on-chain allowance for that spender, so the execution flow
 * doesn't ask the user to re-approve a token they've already approved.
 * Ported from bridgeService.js (original lines ~989-1057), logic unchanged.
 */
export const filterApproveStepsByAllowance = async (quote, ownerAddress) => {
    if (!quote?.steps || !ownerAddress) {
        return quote
    }

    const approvalTargets = new Map()

    for (const step of quote.steps) {
        if (!isApprovalStepId(step.id)) continue
        for (const item of step.items || []) {
            const tokenAddress = item.data?.to
            const parsed = parseApproveData(item.data?.data)
            if (!tokenAddress || !parsed) continue
            const chainId = Number(item.data?.chainId)
            const key = `${chainId}-${tokenAddress.toLowerCase()}-${parsed.spender.toLowerCase()}`
            const existing = approvalTargets.get(key)
            if (!existing || parsed.amount > existing.requiredAmount) {
                approvalTargets.set(key, {
                    chainId,
                    tokenAddress,
                    spender: parsed.spender,
                    requiredAmount: parsed.amount,
                })
            }
        }
    }

    if (approvalTargets.size === 0) {
        return quote
    }

    const allowanceEntries = await Promise.all(
        Array.from(approvalTargets.entries()).map(async ([key, entry]) => {
            const allowance = await checkTokenAllowance(
                entry.chainId,
                entry.tokenAddress,
                ownerAddress,
                entry.spender
            )
            return [key, allowance]
        })
    )

    const allowanceMap = new Map(allowanceEntries)

    const filteredSteps = quote.steps
        .map(step => {
            if (!isApprovalStepId(step.id)) return step

            const items = (step.items || []).filter(item => {
                const tokenAddress = item.data?.to
                const parsed = parseApproveData(item.data?.data)
                if (!tokenAddress || !parsed) return true
                const chainId = Number(item.data?.chainId)
                const key = `${chainId}-${tokenAddress.toLowerCase()}-${parsed.spender.toLowerCase()}`
                const allowance = allowanceMap.get(key)
                const required = approvalTargets.get(key)?.requiredAmount
                if (allowance !== undefined && required !== undefined && allowance >= required) {
                    return false
                }
                return true
            })

            return { ...step, items }
        })
        .filter(step => !isApprovalStepId(step.id) || (step.items && step.items.length > 0))

    return { ...quote, steps: filteredSteps }
}

const buildRelayError = async (response, fallbackMessage) => {
    let data: { message?: string; errorCode?: string; errorData?: unknown; requestId?: string } = {}
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

const normalizeRelayEndpoint = (endpoint) => {
    if (!endpoint) return null
    if (endpoint.startsWith('http')) return endpoint
    if (endpoint.startsWith('/')) return `${RELAY_API_BASE}${endpoint}`
    return `${RELAY_API_BASE}/${endpoint}`
}

/** Submits a signed permit back to Relay. Ported from bridgeService.js unchanged. */
export const submitRelaySignature = async ({ signature, post }) => {
    if (!signature) {
        throw new Error('Missing signature for permit submission')
    }
    if (!post?.endpoint) {
        throw new Error('Missing permit submission endpoint')
    }

    const endpoint = normalizeRelayEndpoint(post.endpoint)
    const method = (post.method || 'POST').toUpperCase()
    const hasBody = method !== 'GET' && method !== 'HEAD'
    const url = new URL(endpoint)
    url.searchParams.set('signature', signature)

    const response = await fetch(url.toString(), {
        method,
        headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
        body: hasBody && post.body ? JSON.stringify(post.body) : undefined,
    })

    if (!response.ok) {
        throw await buildRelayError(response, `Permit submission failed: ${response.status}`)
    }

    return await response.json().catch(() => ({}))
}

const normalizeStatusEndpoint = (endpointOrRequestId) => {
    if (!endpointOrRequestId) return null
    if (endpointOrRequestId.startsWith('http')) return endpointOrRequestId
    if (endpointOrRequestId.startsWith('/')) {
        return `${RELAY_API_BASE}${endpointOrRequestId}`
    }
    return `${RELAY_API_BASE}/intents/status/v3?requestId=${endpointOrRequestId}`
}

/**
 * Polls Relay for cross-chain bridge status until success/failure or
 * maxAttempts is reached. Ported from bridgeService.js unchanged.
 */
export const pollBridgeStatus = async (endpointOrRequestId, maxAttempts = 60, intervalMs = 2000) => {
    const statusUrl = normalizeStatusEndpoint(endpointOrRequestId)
    if (!statusUrl) {
        return { success: false, error: 'Missing status endpoint' }
    }

    let lastStatus = null
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(statusUrl)

            if (!response.ok) {
                await new Promise(r => setTimeout(r, intervalMs))
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

            await new Promise(r => setTimeout(r, intervalMs))
        } catch {
            await new Promise(r => setTimeout(r, intervalMs))
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

/** True if the error looks like the user rejected/cancelled a wallet prompt, not a real failure. */
export const isUserRejection = (error) => {
    if (!error) return false
    const message = (error.message || error.shortMessage || '').toLowerCase()
    const revertHint = message.includes('revert') || message.includes('reverted') ||
        message.includes('execution reverted') || message.includes('simulation')
    if ((error.code === 4001 || error.code === 'ACTION_REJECTED') && !revertHint) {
        return true
    }
    return message.includes('rejected') || message.includes('denied') ||
        message.includes('cancelled') || message.includes('canceled') ||
        message.includes('user refused') || message.includes('user declined') ||
        message.includes('user closed') || message.includes('user rejected')
}
