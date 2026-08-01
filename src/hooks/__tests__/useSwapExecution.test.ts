import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSwapExecution } from '../useSwapExecution'
import { useWalletClient } from 'wagmi'
import { checkTokenAllowance, pollBridgeStatus, isUserRejection } from '../../services/execution'
import type { Quote, QuoteStep } from '../../services/aggregators/types'

vi.mock('wagmi', () => ({
  useWalletClient: vi.fn(),
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
    })),
  }
})

vi.mock('../../services/execution', () => ({
  checkTokenAllowance: vi.fn(),
  pollBridgeStatus: vi.fn(),
  isUserRejection: vi.fn(),
}))

const OWNER = '0x000000000000000000000000000000000000dEaD'
const SPENDER = '0x1111111111111111111111111111111111111111'

const buildApproveCalldata = (spender: string, amount: bigint): string => {
  const spenderHex = spender.slice(2).toLowerCase().padStart(64, '0')
  const amountHex = amount.toString(16).padStart(64, '0')
  return `0x095ea7b3${spenderHex}${amountHex}`
}

const swapStep: QuoteStep = {
  type: 'swap',
  to: '0x2222222222222222222222222222222222222222',
  data: '0xdeadbeef',
  value: '0',
  chainId: 8453,
}

const approveStep: QuoteStep = {
  type: 'approve',
  to: '0x3333333333333333333333333333333333333333', // token address
  data: buildApproveCalldata(SPENDER, 1000n),
  value: '0',
  chainId: 8453,
}

const makeQuote = (steps: QuoteStep[], overrides: Partial<Quote> = {}): Quote => ({
  aggregator: 'lifi',
  toAmount: '1',
  toAmountMin: '1',
  estimatedGasUsd: 0,
  feeUsd: 0,
  netOutputUsd: 1,
  durationSeconds: 1,
  steps,
  raw: null,
  ...overrides,
})

let sendTransactionMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  sendTransactionMock = vi.fn().mockResolvedValue('0xhash')
  vi.mocked(useWalletClient).mockReturnValue({
    data: { sendTransaction: sendTransactionMock },
  } as unknown as ReturnType<typeof useWalletClient>)
  vi.mocked(checkTokenAllowance).mockResolvedValue(0n)
  vi.mocked(pollBridgeStatus).mockResolvedValue({ success: true, status: {} })
  vi.mocked(isUserRejection).mockReturnValue(false)
})

describe('useSwapExecution', () => {
  it('sends one transaction for a single swap step and ends in success', async () => {
    const { result } = renderHook(() => useSwapExecution())
    const quote = makeQuote([swapStep])

    await act(async () => {
      await result.current.execute(quote, OWNER)
    })

    expect(sendTransactionMock).toHaveBeenCalledTimes(1)
    expect(sendTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ account: OWNER, to: swapStep.to, data: swapStep.data, chainId: swapStep.chainId }),
    )
    await waitFor(() => expect(result.current.status).toBe('success'))
  })

  it('skips sending the approve transaction when allowance is already sufficient', async () => {
    vi.mocked(checkTokenAllowance).mockResolvedValue(2000n) // >= required 1000n

    const { result } = renderHook(() => useSwapExecution())
    const quote = makeQuote([approveStep, swapStep])

    await act(async () => {
      await result.current.execute(quote, OWNER)
    })

    expect(sendTransactionMock).toHaveBeenCalledTimes(1)
    expect(sendTransactionMock).toHaveBeenCalledWith(expect.objectContaining({ to: swapStep.to }))
    await waitFor(() => expect(result.current.status).toBe('success'))
  })

  it('sends both the approve and following step, in order, when allowance is insufficient', async () => {
    vi.mocked(checkTokenAllowance).mockResolvedValue(0n) // < required 1000n

    const { result } = renderHook(() => useSwapExecution())
    const quote = makeQuote([approveStep, swapStep])

    await act(async () => {
      await result.current.execute(quote, OWNER)
    })

    expect(sendTransactionMock).toHaveBeenCalledTimes(2)
    expect(sendTransactionMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: approveStep.to }))
    expect(sendTransactionMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: swapStep.to }))
    await waitFor(() => expect(result.current.status).toBe('success'))
  })

  it('ends as rejected, not error, when sendTransaction rejects with a user rejection', async () => {
    const rejectionError = new Error('user rejected the request')
    sendTransactionMock.mockRejectedValue(rejectionError)
    vi.mocked(isUserRejection).mockReturnValue(true)

    const { result } = renderHook(() => useSwapExecution())
    const quote = makeQuote([swapStep])

    await act(async () => {
      await result.current.execute(quote, OWNER)
    })

    expect(result.current.status).toBe('rejected')
  })

  it('polls the Relay status endpoint for a bridge step before reporting success', async () => {
    const checkEndpoint = 'https://api.relay.link/intents/status/v3?requestId=abc123'
    const bridgeStep: QuoteStep = {
      type: 'bridge',
      to: '0x4444444444444444444444444444444444444444',
      data: '0xfeedface',
      value: '0',
      chainId: 137,
    }
    const quote = makeQuote([bridgeStep], {
      aggregator: 'relay',
      raw: {
        steps: [
          {
            id: 'bridge',
            items: [
              {
                check: { endpoint: checkEndpoint },
                data: { to: bridgeStep.to, data: bridgeStep.data, value: bridgeStep.value, chainId: bridgeStep.chainId },
              },
            ],
          },
        ],
      },
    })

    const { result } = renderHook(() => useSwapExecution())

    await act(async () => {
      await result.current.execute(quote, OWNER)
    })

    expect(pollBridgeStatus).toHaveBeenCalledWith(checkEndpoint)
    await waitFor(() => expect(result.current.status).toBe('success'))
  })
})
