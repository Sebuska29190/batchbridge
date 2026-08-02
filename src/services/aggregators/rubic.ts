import { createPublicClient, http, erc20Abi, formatUnits } from 'viem'
import { getChainConfig } from '../../config/chains'
import type { Aggregator, Quote, QuoteRequest, QuoteStep } from './types'

const RUBIC_PROXY_BASE = '/api/rubic'
const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000'

// Placeholder — swap in the real Rubic integrator address before production.
// Must be a validly-checksummed 40-hex-char address: Rubic's API rejects
// anything else with "isn't a correct wallet address" (confirmed live -
// a previous version of this constant was missing 2 leading zeros and
// silently 400'd every quote).
export const RUBIC_INTEGRATOR_ADDRESS = '0x000000000000000000000000000000000000dEaD'

/**
 * chainId -> Rubic's own text blockchain identifier. Rubic doesn't accept
 * numeric chain ids, and its names don't always match our ChainConfig.name
 * (e.g. our "BNB Chain" is Rubic's "BNB", our "Gnosis" is Rubic's "XDAI").
 */
const RUBIC_BLOCKCHAIN_BY_CHAIN_ID: Record<number, string> = {
  1: 'ETH',
  10: 'OPTIMISM',
  56: 'BNB',
  100: 'XDAI',
  137: 'POLYGON',
  250: 'FANTOM',
  324: 'ZKSYNC',
  5000: 'MANTLE',
  8453: 'BASE',
  34443: 'MODE',
  42161: 'ARBITRUM',
  42220: 'CELO',
  43114: 'AVALANCHE',
  59144: 'LINEA',
  81457: 'BLAST',
  534352: 'SCROLL',
}

const isNativeToken = (address: string): boolean =>
  address.toLowerCase() === '0x0' || address.toLowerCase() === NATIVE_ADDRESS

const getTokenDecimals = async (chainId: number, tokenAddress: string): Promise<number> => {
  if (isNativeToken(tokenAddress)) return 18

  const chainConfig = getChainConfig(chainId)
  if (!chainConfig) throw new Error(`Unsupported chain for Rubic: ${chainId}`)

  const client = createPublicClient({
    transport: http(chainConfig.rpcUrls[0]),
  })

  // Cast around a viem@2.55 generic-inference quirk on readContract (same
  // issue already present, unfixed, in bridgeService.ts's allowance calls).
  return (client.readContract as any)({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
  }) as Promise<number>
}

interface RubicQuoteBestResponse {
  estimate: {
    destinationWeiAmount: string
    destinationWeiMinAmount: string
    destinationUsdAmount: number
    durationInMinutes: number
  }
  fees: {
    gasTokenFees: {
      gas: {
        totalUsdAmount: number | null
      }
    }
    percentFees: {
      percent: number
    }
  }
  transaction?: {
    approvalAddress?: string
  }
}

export const rubicAggregator: Aggregator = {
  id: 'rubic',
  supportsCrossChain: true,

  supportsChain(chainId: number): boolean {
    return Boolean(RUBIC_BLOCKCHAIN_BY_CHAIN_ID[chainId])
  },

  async getQuote(req: QuoteRequest): Promise<Quote> {
    const srcBlockchain = RUBIC_BLOCKCHAIN_BY_CHAIN_ID[req.fromChainId]
    const dstBlockchain = RUBIC_BLOCKCHAIN_BY_CHAIN_ID[req.toChainId]
    if (!srcBlockchain) throw new Error(`Unsupported chain for Rubic: ${req.fromChainId}`)
    if (!dstBlockchain) throw new Error(`Unsupported chain for Rubic: ${req.toChainId}`)

    const srcDecimals = await getTokenDecimals(req.fromChainId, req.fromToken)
    const srcTokenAmount = formatUnits(BigInt(req.amount), srcDecimals)

    const response = await fetch(`${RUBIC_PROXY_BASE}/routes/quoteBest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcTokenAddress: isNativeToken(req.fromToken) ? NATIVE_ADDRESS : req.fromToken,
        srcTokenBlockchain: srcBlockchain,
        srcTokenAmount,
        dstTokenAddress: isNativeToken(req.toToken) ? NATIVE_ADDRESS : req.toToken,
        dstTokenBlockchain: dstBlockchain,
        integratorAddress: RUBIC_INTEGRATOR_ADDRESS,
      }),
    })

    if (!response.ok) {
      throw new Error(`Rubic quote failed: ${response.status}`)
    }

    const data = (await response.json()) as RubicQuoteBestResponse

    // Silently accepting an integrator fee we didn't ask for is not
    // acceptable — hard-fail instead of quietly returning a worse quote.
    if (data.fees.percentFees.percent > 0) {
      throw new Error(`Rubic quote carries an unexpected fee: ${data.fees.percentFees.percent}%`)
    }

    const feeUsd = (data.fees.percentFees.percent / 100) * data.estimate.destinationUsdAmount
    const estimatedGasUsd = data.fees.gasTokenFees.gas.totalUsdAmount ?? 0

    const approvalAddress = data.transaction?.approvalAddress
    const steps: QuoteStep[] = approvalAddress
      ? [
          {
            // Rubic's quoteBest response (called without a connected wallet
            // address) only returns the router/approval address, not
            // executable calldata. Building the actual calldata requires a
            // follow-up call once a wallet is connected — out of scope here,
            // that belongs to the execution layer (a later task).
            type: req.fromChainId === req.toChainId ? 'swap' : 'bridge',
            to: approvalAddress,
            data: '0x',
            value: '0',
            chainId: req.fromChainId,
          },
        ]
      : []

    return {
      aggregator: 'rubic',
      toAmount: data.estimate.destinationWeiAmount,
      toAmountMin: data.estimate.destinationWeiMinAmount,
      estimatedGasUsd,
      feeUsd,
      netOutputUsd: data.estimate.destinationUsdAmount - feeUsd - estimatedGasUsd,
      durationSeconds: data.estimate.durationInMinutes * 60,
      steps,
      raw: data,
    }
  },
}
