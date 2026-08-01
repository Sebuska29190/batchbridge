import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAddress } from 'viem'
import { paraswapAggregator } from '../paraswap'
import type { QuoteRequest } from '../types'

// Real captured response: 10 USDC -> WETH on Base, side=SELL.
const PARASWAP_PRICES_RESPONSE = {
  priceRoute: {
    blockNumber: 49408262,
    network: 8453,
    srcToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    srcDecimals: 6,
    srcAmount: '10000000',
    destToken: '0x4200000000000000000000000000000000000006',
    destDecimals: 18,
    destAmount: '5384085056069753',
    bestRoute: [],
    gasCostUSD: '0.002378',
    gasCost: '209300',
    side: 'SELL',
    version: '5',
    contractAddress: '0x59C7C832e96D2568bea6db468C1aAdcbbDa08A52',
    tokenTransferProxy: '0x93aAAe79a53759cD164340E4C8766E4Db5331cD7',
    contractMethod: 'simpleSwap',
    partnerFee: 0.01,
    srcUSD: '9.9986300000',
    destUSD: '10.0156903847',
    destAmountAfterFee: '5383546647564146',
    partner: 'anon',
    maxImpactReached: false,
    hmac: '067e73c3c85d188cb15e3f65b0d4d15a0b2e62c8',
  },
}

// Real captured transaction-build response for the same route.
const PARASWAP_TX_RESPONSE = {
  from: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  to: '0x59C7C832e96D2568bea6db468C1aAdcbbDa08A52',
  value: '0',
  data: '0x54e3f31b0000000000000000000000000000000000000000000000000000000000000020',
  gasPrice: '6100000',
  chainId: 8453,
}

const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const WETH_BASE = '0x4200000000000000000000000000000000000006'

const baseRequest: QuoteRequest = {
  fromChainId: 8453,
  toChainId: 8453,
  fromToken: USDC_BASE,
  toToken: WETH_BASE,
  amount: '10000000', // 10 USDC, 6 decimals
  fromAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  slippageBps: 50,
}

const DECIMALS_BY_TOKEN: Record<string, number> = {
  [USDC_BASE.toLowerCase()]: 6,
  [WETH_BASE.toLowerCase()]: 18,
}

const encodeUintResult = (value: number): string => `0x${value.toString(16).padStart(64, '0')}`

function stubFetch({ pricesBody = PARASWAP_PRICES_RESPONSE, txBody = PARASWAP_TX_RESPONSE, pricesOk = true, txOk = true } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url.includes('/api/paraswap/prices')) {
      return new Response(JSON.stringify(pricesBody), {
        status: pricesOk ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.includes('/api/paraswap/transactions')) {
      return new Response(JSON.stringify(txBody), {
        status: txOk ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Otherwise this is an on-chain decimals() RPC lookup.
    const rawBody = init?.body ? JSON.parse(String(init.body)) : {}
    const tokenAddress = String(rawBody?.params?.[0]?.to || '').toLowerCase()
    const decimals = DECIMALS_BY_TOKEN[tokenAddress] ?? 18
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: encodeUintResult(decimals) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('paraswapAggregator', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('has the expected static shape', () => {
    expect(paraswapAggregator.id).toBe('paraswap')
    expect(paraswapAggregator.supportsCrossChain).toBe(false)
  })

  it('maps a real ParaSwap prices + transactions response onto the Quote shape', async () => {
    stubFetch()

    const quote = await paraswapAggregator.getQuote(baseRequest)

    expect(quote.aggregator).toBe('paraswap')
    expect(quote.toAmount).toBe('5384085056069753')
    expect(quote.toAmountMin).toBe('5357164630789404') // destAmount * 9950 / 10000
    expect(quote.estimatedGasUsd).toBeCloseTo(0.002378, 6)
    expect(quote.feeUsd).toBe(0)
    expect(quote.netOutputUsd).toBeCloseTo(10.0156903847 - 0.002378, 6)
    expect(quote.steps).toHaveLength(1)
    expect(quote.steps[0]).toMatchObject({
      type: 'swap',
      to: PARASWAP_TX_RESPONSE.to,
      data: PARASWAP_TX_RESPONSE.data,
      value: PARASWAP_TX_RESPONSE.value,
      chainId: 8453,
    })
  })

  it('fetches the prices route before building the transaction (two sequential calls)', async () => {
    const fetchMock = stubFetch()

    await paraswapAggregator.getQuote(baseRequest)

    const pricesCallIndex = fetchMock.mock.calls.findIndex(([url]) => String(url).includes('/api/paraswap/prices'))
    const txCallIndex = fetchMock.mock.calls.findIndex(([url]) => String(url).includes('/api/paraswap/transactions'))
    expect(pricesCallIndex).toBeGreaterThanOrEqual(0)
    expect(txCallIndex).toBeGreaterThan(pricesCallIndex)
  })

  it('checksums a non-checksummed fromAddress before sending userAddress to ParaSwap', async () => {
    const fetchMock = stubFetch()

    const lowercaseDeadAddress = '0x000000000000000000000000000000000000dead'
    await paraswapAggregator.getQuote({ ...baseRequest, fromAddress: lowercaseDeadAddress })

    const txCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/paraswap/transactions'))
    expect(txCall).toBeDefined()
    const body = JSON.parse(txCall![1]!.body as string)
    expect(body.userAddress).toBe(getAddress(lowercaseDeadAddress))
    expect(body.userAddress).not.toBe(lowercaseDeadAddress)
  })

  it('sends destAmount (post-slippage minimum) rather than the raw destAmount to /transactions', async () => {
    const fetchMock = stubFetch()

    await paraswapAggregator.getQuote(baseRequest)

    const txCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/paraswap/transactions'))
    const body = JSON.parse(txCall![1]!.body as string)
    expect(body.destAmount).toBe('5357164630789404')
    expect(body.srcAmount).toBe('10000000')
    expect(body.partner).toBe('anon')
  })
})
