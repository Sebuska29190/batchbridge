import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rubicAggregator, RUBIC_INTEGRATOR_ADDRESS } from '../rubic'
import type { QuoteRequest } from '../types'

// Real captured response: 10 USDC (Base) -> MATIC (Polygon), integratorAddress set.
// fees.percentFees.percent is 0 (no integrator fee charged).
const RUBIC_ZEROFEE_RESPONSE = {
  id: '8895ca1b-11e1-4c4c-92f9-e4cba40860ca',
  tokens: {
    from: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amount: '10',
      blockchain: 'BASE',
      blockchainId: 8453,
      decimals: 6,
      name: 'USD Coin',
      price: 0.999877,
      symbol: 'USDC',
    },
    to: {
      address: '0x0000000000000000000000000000000000000000',
      blockchain: 'POLYGON',
      blockchainId: 137,
      decimals: 18,
      name: 'Matic Network',
      price: 0.071505,
      symbol: 'MATIC',
    },
  },
  swapType: 'cross-chain',
  providerType: 'lifi',
  estimate: {
    destinationTokenAmount: '139.682277393927819124',
    destinationTokenMinAmount: '135.49180907210998455',
    destinationUsdAmount: 9.99,
    destinationUsdMinAmount: 9.69,
    destinationWeiAmount: '139682277393927819124',
    destinationWeiMinAmount: '135491809072109984550',
    durationInMinutes: 1,
    intermidiateTokenWeiAmount: '0',
    priceImpact: 0.11,
    slippage: 0.03,
  },
  fees: {
    gasTokenFees: {
      gas: {
        baseFee: null,
        gasLimit: '1451880',
        gasPrice: '6000000',
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        totalUsdAmount: 0.02,
        totalWeiAmount: '8711280000000',
      },
      nativeToken: {
        address: '0x0000000000000000000000000000000000000000',
        blockchain: 'BASE',
        blockchainId: 8453,
        decimals: 18,
        name: 'ETH',
        price: 1864.88,
        symbol: 'ETH',
      },
      protocol: {
        fixedAmount: '0.001200797329426739',
        fixedUsdAmount: 2.24,
        fixedWeiAmount: '1200797329426739',
      },
      provider: { fixedAmount: '0', fixedUsdAmount: 0, fixedWeiAmount: '0' },
    },
    percentFees: {
      percent: 0,
      token: {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        blockchain: 'BASE',
        blockchainId: 8453,
        decimals: 6,
        name: 'USD Coin',
        price: 1,
        symbol: 'USDC',
      },
    },
  },
  routing: [],
  transaction: { approvalAddress: '0x3335733c454805df6a77f825f266e136FB4a3333' },
  warnings: [],
  useRubicContract: true,
}

// Same route, but requested WITHOUT integratorAddress: Rubic silently applies
// its default 0.4% fee (fees.percentFees.percent is 0.4 here instead of 0).
const RUBIC_DEFAULT_FEE_RESPONSE = {
  ...RUBIC_ZEROFEE_RESPONSE,
  providerType: 'rango',
  fees: {
    ...RUBIC_ZEROFEE_RESPONSE.fees,
    percentFees: {
      percent: 0.4,
      token: RUBIC_ZEROFEE_RESPONSE.fees.percentFees.token,
    },
  },
}

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const NATIVE = '0x0000000000000000000000000000000000000000'

const baseRequest: QuoteRequest = {
  fromChainId: 8453,
  toChainId: 137,
  fromToken: USDC_BASE,
  toToken: NATIVE,
  amount: '10000000', // 10 USDC, 6 decimals
  fromAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  slippageBps: 50,
}

// decimals() eth_call result encoding uint8(6), as returned by an RPC node.
const DECIMALS_6_RPC_RESULT = '0x0000000000000000000000000000000000000000000000000000000000000006'

function stubFetch(rubicResponseBody: unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/rubic/')) {
      return new Response(JSON.stringify(rubicResponseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Any other call is treated as the on-chain decimals() RPC lookup.
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: DECIMALS_6_RPC_RESULT }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('rubicAggregator', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('has the expected static shape', () => {
    expect(rubicAggregator.id).toBe('rubic')
    expect(rubicAggregator.supportsCrossChain).toBe(true)
  })

  it('supportsChain returns true only for our 16 configured chains', () => {
    for (const chainId of [1, 10, 56, 100, 137, 250, 324, 5000, 8453, 34443, 42161, 42220, 43114, 59144, 81457, 534352]) {
      expect(rubicAggregator.supportsChain(chainId)).toBe(true)
    }
    expect(rubicAggregator.supportsChain(999999)).toBe(false)
  })

  it('maps a real Rubic quoteBest response onto the Quote shape', async () => {
    stubFetch(RUBIC_ZEROFEE_RESPONSE)

    const quote = await rubicAggregator.getQuote(baseRequest)

    expect(quote.aggregator).toBe('rubic')
    expect(quote.toAmount).toBe('139682277393927819124')
    expect(quote.toAmountMin).toBe('135491809072109984550')
    expect(quote.estimatedGasUsd).toBe(0.02)
    expect(quote.feeUsd).toBe(0)
    expect(quote.netOutputUsd).toBeCloseTo(9.99 - 0.02, 6)
    expect(quote.durationSeconds).toBe(60)
    expect(quote.steps.length).toBeGreaterThan(0)
    expect(quote.steps[0].chainId).toBe(8453)
    expect(quote.raw).toEqual(RUBIC_ZEROFEE_RESPONSE)
  })

  it('sends the human-readable (non-wei) amount and Rubic blockchain names', async () => {
    const fetchMock = stubFetch(RUBIC_ZEROFEE_RESPONSE)

    await rubicAggregator.getQuote(baseRequest)

    const rubicCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/rubic/'))
    expect(rubicCall).toBeDefined()
    const body = JSON.parse(rubicCall![1]!.body as string)
    expect(body.srcTokenAmount).toBe('10')
    expect(body.srcTokenBlockchain).toBe('BASE')
    expect(body.dstTokenBlockchain).toBe('POLYGON')
  })

  it('always sends a non-empty integratorAddress', async () => {
    const fetchMock = stubFetch(RUBIC_ZEROFEE_RESPONSE)

    await rubicAggregator.getQuote(baseRequest)

    const rubicCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/rubic/'))
    const body = JSON.parse(rubicCall![1]!.body as string)
    expect(body.integratorAddress).toBeTruthy()
    expect(typeof body.integratorAddress).toBe('string')
  })

  it('uses RUBIC_INTEGRATOR_ADDRESS as the module-level source of truth', async () => {
    const fetchMock = stubFetch(RUBIC_ZEROFEE_RESPONSE)

    await rubicAggregator.getQuote(baseRequest)

    const rubicCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/rubic/'))
    const body = JSON.parse(rubicCall![1]!.body as string)
    expect(body.integratorAddress).toBe(RUBIC_INTEGRATOR_ADDRESS)
  })

  it('throws instead of silently accepting a non-zero integrator fee', async () => {
    stubFetch(RUBIC_DEFAULT_FEE_RESPONSE)

    await expect(rubicAggregator.getQuote(baseRequest)).rejects.toThrow()
  })
})
