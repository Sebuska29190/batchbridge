import { createPublicClient, http, erc20Abi, getAddress } from 'viem'
import { getChainConfig } from '../../config/chains'
import type { Aggregator, Quote, QuoteRequest, QuoteStep } from './types'

const PARASWAP_PROXY_BASE = '/api/paraswap'
const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000'
// ParaSwap's own pseudo-address representing the chain's native token.
const PARASWAP_NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEeeeeEeeeeeeeeEEeE'

const isNativeToken = (address: string): boolean =>
  address.toLowerCase() === '0x0' || address.toLowerCase() === NATIVE_ADDRESS

const toParaswapAddress = (address: string): string =>
  isNativeToken(address) ? PARASWAP_NATIVE_ADDRESS : address

const getTokenDecimals = async (chainId: number, tokenAddress: string): Promise<number> => {
  if (isNativeToken(tokenAddress)) return 18

  const chainConfig = getChainConfig(chainId)
  if (!chainConfig) throw new Error(`Unsupported chain for ParaSwap: ${chainId}`)

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

interface ParaswapPriceRoute {
  destAmount: string
  gasCostUSD: string
  destUSD: string
  [key: string]: unknown
}

interface ParaswapPricesResponse {
  priceRoute: ParaswapPriceRoute
}

interface ParaswapTransactionResponse {
  from: string
  to: string
  value: string
  data: string
  chainId: number
}

export const paraswapAggregator: Aggregator = {
  id: 'paraswap',
  supportsCrossChain: false,

  supportsChain(chainId: number): boolean {
    return Boolean(getChainConfig(chainId))
  },

  async getQuote(req: QuoteRequest): Promise<Quote> {
    // ParaSwap is same-chain only; the quote engine skips this adapter
    // whenever fromChainId !== toChainId, so we don't handle that case here.
    const chainId = req.fromChainId

    const [srcDecimals, destDecimals] = await Promise.all([
      getTokenDecimals(chainId, req.fromToken),
      getTokenDecimals(chainId, req.toToken),
    ])

    const srcToken = toParaswapAddress(req.fromToken)
    const destToken = toParaswapAddress(req.toToken)

    const pricesUrl =
      `${PARASWAP_PROXY_BASE}/prices?srcToken=${srcToken}&srcDecimals=${srcDecimals}` +
      `&destToken=${destToken}&destDecimals=${destDecimals}&amount=${req.amount}` +
      `&side=SELL&network=${chainId}`

    const pricesResponse = await fetch(pricesUrl)
    if (!pricesResponse.ok) {
      throw new Error(`ParaSwap price lookup failed: ${pricesResponse.status}`)
    }
    const { priceRoute } = (await pricesResponse.json()) as ParaswapPricesResponse

    // ParaSwap's /prices doesn't take slippage as input (it's an instant
    // same-chain swap) — slippage protection is enforced client-side via
    // the destAmount we send to /transactions.
    const destAmount = BigInt(priceRoute.destAmount)
    const destAmountMin = (destAmount * BigInt(10000 - req.slippageBps)) / BigInt(10000)

    // ParaSwap validates the checksum of userAddress, not just the hex
    // format — a non-checksummed address is rejected outright, so we
    // always checksum here rather than trust the caller already did.
    const userAddress = getAddress(req.fromAddress)

    const txResponse = await fetch(`${PARASWAP_PROXY_BASE}/transactions/${chainId}?ignoreChecks=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcToken,
        srcDecimals,
        destToken,
        destDecimals,
        srcAmount: req.amount,
        destAmount: destAmountMin.toString(),
        priceRoute,
        userAddress,
        partner: 'anon',
      }),
    })
    if (!txResponse.ok) {
      throw new Error(`ParaSwap transaction build failed: ${txResponse.status}`)
    }
    const tx = (await txResponse.json()) as ParaswapTransactionResponse

    const estimatedGasUsd = Number(priceRoute.gasCostUSD)
    // priceRoute.partnerFee is ParaSwap's own referral fee, already
    // reflected in destAmount/destUSD — we don't charge anything on top.
    const feeUsd = 0
    const destUsd = Number(priceRoute.destUSD)

    // ParaSwap's Augustus contract handles the approve internally if the
    // user has already approved the tokenTransferProxy; we just emit the
    // swap step here. Approval-step handling belongs to the execution
    // layer, built in a later task.
    const steps: QuoteStep[] = [
      {
        type: 'swap',
        to: tx.to,
        data: tx.data,
        value: tx.value,
        chainId,
      },
    ]

    return {
      aggregator: 'paraswap',
      toAmount: priceRoute.destAmount,
      toAmountMin: destAmountMin.toString(),
      estimatedGasUsd,
      feeUsd,
      netOutputUsd: destUsd - feeUsd - estimatedGasUsd,
      // Same-chain instant swap — one confirmation, no bridging wait.
      durationSeconds: 15,
      steps,
      raw: { priceRoute, transaction: tx },
    }
  },
}
