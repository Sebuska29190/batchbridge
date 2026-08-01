import { useCallback, useState } from 'react'
import { useWalletClient } from 'wagmi'
import { createPublicClient, http } from 'viem'
import { getChainConfig } from '../config/chains'
import { checkTokenAllowance, pollBridgeStatus, isUserRejection } from '../services/execution'
import type { Quote, QuoteStep } from '../services/aggregators/types'

export type ExecutionStatus = 'idle' | 'approving' | 'executing' | 'bridging' | 'success' | 'error' | 'rejected'

const APPROVE_SELECTOR = '0x095ea7b3'

/**
 * Decodes an ERC-20 `approve(spender, amount)` calldata blob.
 *
 * ADAPTATION NOTE (allowance filtering): `execution.ts`'s
 * `filterApproveStepsByAllowance` was written for the old Relay-specific
 * quote shape (`quote.steps[].id` / `quote.steps[].items[]`, each item
 * carrying `item.data.to` / `item.data.data`), not the new unified,
 * flat `Quote.steps: QuoteStep[]` shape from `aggregators/types.ts` where
 * every step already has its own `type: 'approve' | 'swap' | 'bridge'`,
 * `to`, and `data`. Rather than force-fit the old nested-shape helper (or
 * reach into its private `parseApproveData`, which isn't exported), this
 * hook decodes the same selector/spender/amount layout itself, scoped
 * locally, and calls the still-generic `checkTokenAllowance` directly
 * against each flat `QuoteStep`. Whoever unifies the quote shapes later
 * should be able to delete this local decode + `filterStepsByAllowance`
 * in favor of a shared, shape-agnostic helper.
 */
const decodeApproveCalldata = (data: string): { spender: string; amount: bigint } | null => {
  if (!data) return null
  const normalized = data.toLowerCase()
  if (!normalized.startsWith(APPROVE_SELECTOR)) return null
  const payload = normalized.slice(10)
  if (payload.length < 128) return null
  const spender = `0x${payload.slice(24, 64)}`
  const amount = BigInt(`0x${payload.slice(64, 128)}`)
  return { spender, amount }
}

interface StepWithCheck {
  step: QuoteStep
  /** Relay-only: the raw step's status-polling endpoint, if any (see below). */
  checkEndpoint?: string
}

/**
 * Pairs each flat `QuoteStep` with its Relay "check" endpoint (if this quote
 * came from Relay). Relay's `getQuote` builds `Quote.steps` via
 * `data.steps.flatMap(step => step.items.map(...))` (see aggregators/relay.ts),
 * and `Quote.raw` is that same untouched `data`, so re-running the identical
 * flatMap over `quote.raw.steps` here yields a parallel array in the exact
 * same order/length as `quote.steps` - safe to zip by index.
 */
const buildStepsWithCheck = (quote: Quote): StepWithCheck[] => {
  if (quote.aggregator !== 'relay') {
    return quote.steps.map((step) => ({ step }))
  }

  const raw = quote.raw as { steps?: Array<{ items?: Array<{ check?: { endpoint?: string } }> }> } | null | undefined
  const flatItems = (raw?.steps ?? []).flatMap((s) => s.items ?? [])

  return quote.steps.map((step, i) => ({ step, checkEndpoint: flatItems[i]?.check?.endpoint }))
}

/** Drops `approve` steps the owner already has sufficient on-chain allowance for. */
const filterStepsByAllowance = async (
  steps: StepWithCheck[],
  ownerAddress: string,
): Promise<StepWithCheck[]> => {
  const kept: StepWithCheck[] = []

  for (const entry of steps) {
    if (entry.step.type !== 'approve') {
      kept.push(entry)
      continue
    }

    const parsed = decodeApproveCalldata(entry.step.data)
    if (!parsed) {
      // Can't tell what's being approved - keep the step rather than risk
      // silently skipping a needed approval.
      kept.push(entry)
      continue
    }

    const allowance = await checkTokenAllowance(entry.step.chainId, entry.step.to, ownerAddress, parsed.spender)
    if (allowance >= parsed.amount) continue // already sufficient, drop it

    kept.push(entry)
  }

  return kept
}

const statusForStepType = (type: QuoteStep['type']): ExecutionStatus =>
  type === 'approve' ? 'approving' : type === 'bridge' ? 'bridging' : 'executing'

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/**
 * Executes a quote's steps in order against the connected wallet: filters
 * out already-sufficient approvals, then sends each remaining step's
 * transaction and waits for its receipt before moving to the next (steps
 * are sequential, not parallel, since a later step usually depends on an
 * earlier one - e.g. a swap needs its approve mined first).
 *
 * CROSS-CHAIN STATUS NOTE: only Relay quotes carry a status-polling
 * endpoint in this codebase today (`quote.raw.steps[].items[].check.endpoint`).
 * After a Relay `bridge` step's transaction lands, this hook polls that
 * endpoint via `pollBridgeStatus` and only reports `'success'` once it
 * resolves `{ success: true }`. For LI.FI, Rubic, and ParaSwap there is no
 * equivalent polling wired into `Quote.raw` yet, so for those three the
 * on-chain receipt landing is treated as sufficient to report `'success'` -
 * for genuinely cross-chain routes through those aggregators there is
 * still a destination-chain leg in flight that this hook does not track.
 * Building unified cross-aggregator bridge-status tracking is out of scope
 * here; this is a known gap, not a silent one.
 */
export const useSwapExecution = () => {
  const { data: walletClient } = useWalletClient()
  const [status, setStatus] = useState<ExecutionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  const execute = useCallback(
    async (quote: Quote, ownerAddress: string) => {
      if (!walletClient) {
        setStatus('error')
        setError('No wallet connected')
        return
      }

      setError(null)

      try {
        const stepsWithCheck = await filterStepsByAllowance(buildStepsWithCheck(quote), ownerAddress)

        for (const { step, checkEndpoint } of stepsWithCheck) {
          setStatus(statusForStepType(step.type))

          // Cast past viem/wagmi's overloaded sendTransaction signature: passing
          // `chainId` inline alongside a generic WalletClient's chain-union type
          // makes TS pick an EIP-4844 blob-transaction overload (demanding an
          // unrelated `kzg` field) instead of the plain one we want - the same
          // class of overload-resolution issue execution.ts already casts past
          // with `(client.readContract as any)(...)`.
          const hash = await (walletClient.sendTransaction as any)({
            account: ownerAddress as `0x${string}`,
            to: step.to as `0x${string}`,
            data: step.data as `0x${string}`,
            value: BigInt(step.value),
            chainId: step.chainId,
          })

          const chainConfig = getChainConfig(step.chainId)
          const publicClient = createPublicClient({ transport: http(chainConfig?.rpcUrls[0]) })
          await publicClient.waitForTransactionReceipt({ hash })

          if (step.type === 'bridge' && checkEndpoint) {
            const result = await pollBridgeStatus(checkEndpoint)
            if (!result.success) {
              setStatus('error')
              setError(result.error ?? 'Bridge failed')
              return
            }
          }
        }

        setStatus('success')
      } catch (err) {
        if (isUserRejection(err)) {
          setStatus('rejected')
        } else {
          setStatus('error')
          setError(errorMessage(err))
        }
      }
    },
    [walletClient],
  )

  return { status, error, execute, reset }
}
