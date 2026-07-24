import type { Token, SwapQuote, SwapParams } from '../types'

const PARASWAP_API = '/api/paraswap'
const OKX_API = '/api/okx'
const RELAY_API = 'https://api.relay.link'

const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const isNative = (addr: string) => addr === '0x0000000000000000000000000000000000000000'
const toPara = (addr: string) => isNative(addr) ? NATIVE_ETH : addr

const CHAIN_ID_TO_PARASWAP: Record<number, number> = {
  1: 1, 8453: 8453, 42161: 42161, 10: 10, 137: 137,
}

const CHAIN_ID_TO_OKX: Record<number, string> = {
  1: '1', 8453: '8453', 42161: '42161', 10: '10', 137: '137',
}

export interface AggregatorResult {
  provider: string
  dstAmount: string
  dstAmountFormatted: string
  gasUsd: string
  priceImpact: string
  route: string[]
  txData?: { to: string; data: string; value: string }
}

function formatDstAmount(rawAmount: string, decimals: number): string {
  try {
    const bn = BigInt(rawAmount)
    const divisor = BigInt(10 ** decimals)
    const whole = bn / divisor
    const fraction = bn % divisor
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 6)
    return `${whole}.${fractionStr}`
  } catch {
    return '0'
  }
}

async function fetchParaSwapQuote(params: SwapParams): Promise<AggregatorResult | null> {
  const network = CHAIN_ID_TO_PARASWAP[params.chainId]
  if (!network) return null

  try {
    const srcAmt = (BigInt(Math.floor(parseFloat(params.amount) * 10 ** params.srcToken.decimals))).toString()
    const searchParams = new URLSearchParams({
      srcToken: toPara(params.srcToken.address),
      destToken: toPara(params.dstToken.address),
      srcDecimals: String(params.srcToken.decimals),
      destDecimals: String(params.dstToken.decimals),
      amount: srcAmt,
      side: 'SELL',
      network: String(network),
    })

    const resp = await fetch(`${PARASWAP_API}/prices?${searchParams}`)
    if (!resp.ok) return null

    const data = await resp.json()
    const pr = data.priceRoute
    if (!pr?.destAmount) return null

    const exchanges: string[] = []
    for (const swap of (pr.bestRoute?.[0]?.swaps || [])) {
      for (const ex of (swap.swapExchanges || [])) {
        if (ex.exchange) exchanges.push(ex.exchange)
      }
    }

    return {
      provider: 'ParaSwap',
      dstAmount: pr.destAmount,
      dstAmountFormatted: formatDstAmount(pr.destAmount, params.dstToken.decimals),
      gasUsd: pr.gasCostUSD || '0',
      priceImpact: pr.priceImpact || '0',
      route: [...new Set(exchanges)],
    }
  } catch {
    return null
  }
}

async function fetchOKXQuote(params: SwapParams): Promise<AggregatorResult | null> {
  const chainIndex = CHAIN_ID_TO_OKX[params.chainId]
  if (!chainIndex) return null

  try {
    const srcAmt = (BigInt(Math.floor(parseFloat(params.amount) * 10 ** params.srcToken.decimals))).toString()
    const searchParams = new URLSearchParams({
      chainIndex,
      amount: srcAmt,
      fromTokenAddress: toPara(params.srcToken.address),
      toTokenAddress: toPara(params.dstToken.address),
      slippage: String(params.slippage / 100),
    })

    const resp = await fetch(`${OKX_API}?action=quote&${searchParams}`)
    if (!resp.ok) return null

    const data = await resp.json()
    if (data.error && !data.configured) return null
    const quote = data.data?.[0]
    if (!quote?.toTokenAmount) return null

    return {
      provider: 'OKX DEX',
      dstAmount: quote.toTokenAmount,
      dstAmountFormatted: formatDstAmount(quote.toTokenAmount, params.dstToken.decimals),
      gasUsd: quote.gasPrice || '0',
      priceImpact: quote.priceImpact || '0',
      route: [quote.dexRouter || 'OKX Router'],
    }
  } catch {
    return null
  }
}

async function fetchRelayQuote(params: SwapParams): Promise<AggregatorResult | null> {
  if (params.srcToken.address === params.dstToken.address) return null

  try {
    const srcAmt = (BigInt(Math.floor(parseFloat(params.amount) * 10 ** params.srcToken.decimals))).toString()
    const resp = await fetch(`${RELAY_API}/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: params.userAddress,
        originChainId: params.chainId,
        destinationChainId: params.chainId,
        originCurrency: params.srcToken.address,
        destinationCurrency: params.dstToken.address,
        amount: srcAmt,
        tradeType: 'EXACT_INPUT',
        referrer: 'relay.link',
      }),
    })

    if (!resp.ok) return null
    const data = await resp.json()
    const destAmt = data.details?.currencyOut?.amount
    if (!destAmt) return null

    return {
      provider: 'Relay',
      dstAmount: destAmt,
      dstAmountFormatted: data.details?.currencyOut?.amountFormatted || formatDstAmount(destAmt, params.dstToken.decimals),
      gasUsd: data.fees?.gas?.amountUsd || '0',
      priceImpact: data.details?.totalImpact?.percent || '0',
      route: ['Relay Protocol'],
    }
  } catch {
    return null
  }
}

export async function getAllQuotes(params: SwapParams): Promise<AggregatorResult[]> {
  const results = await Promise.allSettled([
    fetchParaSwapQuote(params),
    fetchOKXQuote(params),
    fetchRelayQuote(params),
  ])

  const quotes: AggregatorResult[] = []
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      quotes.push(result.value)
    }
  }

  return quotes.sort((a, b) => {
    try { return BigInt(b.dstAmount) > BigInt(a.dstAmount) ? 1 : -1 }
    catch { return 0 }
  })
}

export async function getBestQuote(params: SwapParams): Promise<{ best: AggregatorResult; all: AggregatorResult[] } | null> {
  const all = await getAllQuotes(params)
  if (all.length === 0) return null
  return { best: all[0], all }
}

export async function getSwapTx(params: SwapParams, provider: string): Promise<{ to: string; data: string; value: string } | null> {
  if (provider === 'ParaSwap') {
    const srcAmt = (BigInt(Math.floor(parseFloat(params.amount) * 10 ** params.srcToken.decimals))).toString()
    const resp = await fetch(`${PARASWAP_API}/transactions/${params.chainId}?ignoreChecks=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcToken: toPara(params.srcToken.address),
        destToken: toPara(params.dstToken.address),
        srcDecimals: params.srcToken.decimals,
        destDecimals: params.dstToken.decimals,
        srcAmount: srcAmt,
        userAddress: params.userAddress,
        slippage: Math.floor(params.slippage * 100),
      }),
    })
    const data = await resp.json()
    if (!resp.ok || !data.to || !data.data) return null
    return { to: data.to, data: data.data, value: data.value || '0' }
  }

  if (provider === 'OKX DEX') {
    const srcAmt = (BigInt(Math.floor(parseFloat(params.amount) * 10 ** params.srcToken.decimals))).toString()
    const resp = await fetch(OKX_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainIndex: String(params.chainId),
        amount: srcAmt,
        fromTokenAddress: toPara(params.srcToken.address),
        toTokenAddress: toPara(params.dstToken.address),
        slippagePercent: String(params.slippage),
        userWalletAddress: params.userAddress,
        swapMode: 'exactIn',
      }),
    })
    const data = await resp.json()
    if (!resp.ok || !data.data?.[0]) return null
    const tx = data.data[0].tx || data.data[0]
    return { to: tx.to, data: tx.data, value: tx.value || '0' }
  }

  return null
}
