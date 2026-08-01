import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decodeFunctionData, encodeFunctionResult, erc20Abi } from 'viem'
import { getSwappableTokens, lookupCustomToken } from '../tokenRegistry'

// Trimmed real /api/lifi/tokens?chains=8453 response (Base), key fields
// preserved verbatim from a captured 950-token sample.
const LIFI_TOKENS_BASE_SAMPLE = {
  tokens: {
    '8453': [
      {
        chainId: 8453,
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        name: 'ETH',
        decimals: 18,
        priceUSD: '1860.3',
        logoURI:
          'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
        verificationStatus: 'verified',
      },
      {
        chainId: 8453,
        address: '0x37E7C051Dc5A24313cEEC581222882648ba537aa',
        symbol: 'dsETH',
        name: 'Diversified Staked ETH Index',
        decimals: 18,
        priceUSD: '3272.4003373817',
        verificationStatus: 'unverified',
      },
    ],
  },
}

const CUSTOM_TOKEN_ADDRESS = '0x9B5E262cF9bb04869ab40b19AF91D2dc85761722'
const CHAIN_ID = 8453

const SYMBOL_RESULT = (symbol: string) =>
  encodeFunctionResult({ abi: erc20Abi, functionName: 'symbol', result: symbol })
const NAME_RESULT = (name: string) => encodeFunctionResult({ abi: erc20Abi, functionName: 'name', result: name })
const DECIMALS_RESULT = (decimals: number) =>
  encodeFunctionResult({ abi: erc20Abi, functionName: 'decimals', result: decimals })

/** Stubs global fetch to answer both the RPC (eth_call) and DexScreener requests. */
function stubFetch(options: {
  rpcOk?: boolean
  metadata?: { symbol: string; name: string; decimals: number }
  dexResponse?: unknown
}) {
  const { rpcOk = true, metadata = { symbol: 'NOCK', name: 'Nock', decimals: 18 }, dexResponse = { pairs: null } } =
    options

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url.startsWith('https://api.dexscreener.com')) {
      return new Response(JSON.stringify(dexResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Otherwise this is a JSON-RPC eth_call to the chain's RPC.
    if (!rpcOk) {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'execution reverted' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = JSON.parse(String(init?.body ?? '{}'))
    const call = body.params?.[0]
    const { functionName } = decodeFunctionData({ abi: erc20Abi, data: call.data })

    let result: string
    if (functionName === 'symbol') result = SYMBOL_RESULT(metadata.symbol)
    else if (functionName === 'name') result = NAME_RESULT(metadata.name)
    else if (functionName === 'decimals') result = DECIMALS_RESULT(metadata.decimals)
    else throw new Error(`Unexpected function call: ${functionName}`)

    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('getSwappableTokens', () => {
  it('maps the captured LI.FI sample into Token objects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(LIFI_TOKENS_BASE_SAMPLE), { status: 200 }))
    )

    const tokens = await getSwappableTokens(8453)

    expect(tokens).toHaveLength(2)
    expect(tokens[0]).toMatchObject({
      chainId: 8453,
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'ETH',
      decimals: 18,
      priceUsd: 1860.3,
    })
    expect(tokens[1]).toMatchObject({
      symbol: 'dsETH',
      decimals: 18,
      priceUsd: 3272.4003373817,
    })
  })

  it('caches results in localStorage and skips the network call on a second request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(LIFI_TOKENS_BASE_SAMPLE), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const first = await getSwappableTokens(8453)
    const second = await getSwappableTokens(8453)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })
})

describe('lookupCustomToken', () => {
  it('flags lowLiquidity: true when the highest matching DexScreener liquidity is under $10k', async () => {
    stubFetch({
      metadata: { symbol: 'NOCK', name: 'Nock', decimals: 18 },
      dexResponse: {
        pairs: [
          {
            chainId: 'base',
            baseToken: { address: CUSTOM_TOKEN_ADDRESS },
            quoteToken: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
            priceUsd: '0.01148',
            priceNative: '0.01148',
            liquidity: { usd: 5000 },
          },
        ],
      },
    })

    const token = await lookupCustomToken(CHAIN_ID, CUSTOM_TOKEN_ADDRESS)

    expect(token).not.toBeNull()
    expect(token?.symbol).toBe('NOCK')
    expect(token?.lowLiquidity).toBe(true)
  })

  it('does not flag lowLiquidity when the highest matching liquidity is at or above $10k', async () => {
    stubFetch({
      metadata: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      dexResponse: {
        pairs: [
          {
            chainId: 'base',
            baseToken: { address: CUSTOM_TOKEN_ADDRESS },
            quoteToken: { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' },
            priceUsd: '0.9999',
            priceNative: '0.9999',
            liquidity: { usd: 151252.4 },
          },
        ],
      },
    })

    const token = await lookupCustomToken(CHAIN_ID, CUSTOM_TOKEN_ADDRESS)

    expect(token?.lowLiquidity).toBeFalsy()
  })

  it('ignores pairs on a different chain when computing liquidity', async () => {
    stubFetch({
      metadata: { symbol: 'FOO', name: 'Foo Token', decimals: 18 },
      dexResponse: {
        pairs: [
          {
            // High liquidity, but on Polygon, not our requested Base chain.
            chainId: 'polygon',
            baseToken: { address: CUSTOM_TOKEN_ADDRESS },
            quoteToken: { address: '0x0000000000000000000000000000000000dEaD' },
            priceUsd: '1',
            priceNative: '1',
            liquidity: { usd: 5000000 },
          },
        ],
      },
    })

    const token = await lookupCustomToken(CHAIN_ID, CUSTOM_TOKEN_ADDRESS)

    // No pairs match the Base chain slug, so liquidity is effectively unknown/zero.
    expect(token?.lowLiquidity).toBe(true)
  })

  it('returns null when on-chain metadata lookup fails (bad address / not a contract)', async () => {
    stubFetch({ rpcOk: false })

    const token = await lookupCustomToken(CHAIN_ID, CUSTOM_TOKEN_ADDRESS)

    expect(token).toBeNull()
  })
})
