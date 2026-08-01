import { describe, it, expect, vi, beforeEach } from 'vitest'
import { erc20Abi, multicall3Abi, encodeFunctionResult, decodeFunctionData } from 'viem'
import { fetchTokenHoldings } from '../../bridgeService'
import { fetchBalances, discoverHeldTokens, NATIVE_TOKEN_ADDRESS } from '../balances'

describe('fetchTokenHoldings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('fetch should not be called: Routescan is a paid API and must not be used')
    }))
  })

  it('never calls the paid Routescan API', async () => {
    const result = await fetchTokenHoldings('0x0000000000000000000000000000000000dEaD', 8453)
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// New multicall/Blockscout-backed balances module below.
// ---------------------------------------------------------------------------

const OWNER = '0x000000000000000000000000000000000000dEaD'

/** Builds the aggregate3 return payload a Multicall3 contract would produce,
 * given the actual calls it was asked to make (decoded from the eth_call
 * request) and a map of token address (lowercase) -> balance (null = revert). */
function buildAggregate3ReturnData(
  calls: Array<{ target: string; callData: string }>,
  balancesByAddress: Record<string, bigint | null>
): string {
  const results = calls.map(call => {
    const address = call.target.toLowerCase()
    const balance = balancesByAddress[address]
    if (balance === null || balance === undefined) {
      return { success: false, returnData: '0x' as `0x${string}` }
    }
    return {
      success: true,
      returnData: encodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', result: balance }),
    }
  })
  return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results })
}

/** Stubs global fetch to answer JSON-RPC eth_call (routed through Multicall3's
 * aggregate3) and eth_getBalance requests, based on a balances-by-address map
 * and an optional native balance. Also records every request URL seen so
 * tests can assert on which proxy endpoints were (or weren't) hit. */
function stubChainFetch(balancesByAddress: Record<string, bigint | null>, nativeBalance: bigint | null = null) {
  const seenUrls: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    seenUrls.push(url)

    if (!init?.body) {
      throw new Error(`unexpected GET in chain fetch stub: ${url}`)
    }
    const body = JSON.parse(String(init.body))

    if (body.method === 'eth_call') {
      const callData = body.params[0].data as string
      const { args } = decodeFunctionData({ abi: multicall3Abi, data: callData as `0x${string}` })
      const calls = args[0] as Array<{ target: string; allowFailure: boolean; callData: string }>
      const result = buildAggregate3ReturnData(calls, balancesByAddress)
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (body.method === 'eth_getBalance') {
      const hex = `0x${(nativeBalance ?? 0n).toString(16)}`
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: hex }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    throw new Error(`unexpected RPC method in chain fetch stub: ${body.method}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, seenUrls }
}

describe('fetchBalances', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('batches an on-chain multicall3 call and maps token address -> raw balance', async () => {
    const tokenA = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const tokenB = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
    stubChainFetch({
      [tokenA]: 123456789n,
      [tokenB]: 0n,
    })

    const result = await fetchBalances(8453, OWNER, [tokenA, tokenB])

    expect(result[tokenA]).toBe('123456789')
    expect(result[tokenB]).toBe('0')
  })

  it('handles the native token specially via getBalance instead of a multicall entry', async () => {
    const tokenA = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const { fetchMock } = stubChainFetch({ [tokenA]: 500n }, 42000000000000000n)

    const result = await fetchBalances(8453, OWNER, [NATIVE_TOKEN_ADDRESS, tokenA])

    expect(result[NATIVE_TOKEN_ADDRESS]).toBe('42000000000000000')
    expect(result[tokenA]).toBe('500')

    // Native balance must come from eth_getBalance, never from a multicall balanceOf call.
    const bodies = fetchMock.mock.calls.map(([, init]: any) => JSON.parse(init.body))
    expect(bodies.some((b: any) => b.method === 'eth_getBalance')).toBe(true)
  })

  it('allows individual token failures without failing the whole batch', async () => {
    const good = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    const reverting = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
    stubChainFetch({ [good]: 999n, [reverting]: null })

    const result = await fetchBalances(8453, OWNER, [good, reverting])

    expect(result[good]).toBe('999')
    expect(result[reverting]).toBe('0')
  })

  it('chunks more than 200 token addresses into multiple multicall requests', async () => {
    const addresses = Array.from({ length: 250 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`)
    const balancesByAddress: Record<string, bigint> = {}
    addresses.forEach((addr, i) => {
      balancesByAddress[addr.toLowerCase()] = BigInt(i + 1)
    })
    const { fetchMock } = stubChainFetch(balancesByAddress)

    const result = await fetchBalances(8453, OWNER, addresses)

    expect(Object.keys(result)).toHaveLength(250)
    expect(result[addresses[0]]).toBe('1')
    expect(result[addresses[249]]).toBe('250')

    const ethCallCount = fetchMock.mock.calls.filter(([, init]: any) => JSON.parse(init.body).method === 'eth_call').length
    expect(ethCallCount).toBe(2) // ceil(250 / 200)
  })
})

describe('discoverHeldTokens', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps a captured Blockscout token-balances response, computing valueUsd from exchange_rate', async () => {
    const usdt = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    const blockscoutEntry = {
      token: {
        address_hash: usdt,
        decimals: '6',
        exchange_rate: '0.998592',
        name: 'Tether',
        symbol: 'USDT',
        type: 'ERC-20',
      },
      token_id: null,
      token_instance: null,
      value: '686712120759890',
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/blockscout')) {
        return new Response(JSON.stringify([blockscoutEntry]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      // On-chain verification call - confirm the same balance Blockscout reported.
      if (!init?.body) throw new Error(`unexpected GET: ${url}`)
      const body = JSON.parse(String(init.body))
      if (body.method === 'eth_call') {
        const { args } = decodeFunctionData({ abi: multicall3Abi, data: body.params[0].data })
        const calls = args[0] as Array<{ target: string; allowFailure: boolean; callData: string }>
        const result = buildAggregate3ReturnData(calls, { [usdt.toLowerCase()]: 686712120759890n })
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected RPC method: ${body.method}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverHeldTokens(1, OWNER)

    expect(result).toHaveLength(1)
    expect(result[0].address).toBe(usdt)
    expect(result[0].symbol).toBe('USDT')
    expect(result[0].decimals).toBe(6)
    expect(result[0].balance).toBe('686712120759890')
    // 686712120759890 / 1e6 * 0.998592
    expect(result[0].valueUsd).toBeCloseTo((686712120759890 / 1e6) * 0.998592, 4)
  })

  it('drops a token with a stale nonzero Blockscout balance but zero on-chain multicall balance', async () => {
    const staleToken = '0xcE24439F2D9C6a2289F741120FE202248B666666'
    const blockscoutEntry = {
      token: {
        address_hash: staleToken,
        decimals: '18',
        exchange_rate: '0.999209',
        name: 'United Stables',
        symbol: 'U',
        type: 'ERC-20',
      },
      token_id: null,
      token_instance: null,
      value: '113045048674733721988243948',
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/blockscout')) {
        return new Response(JSON.stringify([blockscoutEntry]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (!init?.body) throw new Error(`unexpected GET: ${url}`)
      const body = JSON.parse(String(init.body))
      if (body.method === 'eth_call') {
        const { args } = decodeFunctionData({ abi: multicall3Abi, data: body.params[0].data })
        const calls = args[0] as Array<{ target: string; allowFailure: boolean; callData: string }>
        // On-chain truth says zero, contradicting Blockscout's stale nonzero balance.
        const result = buildAggregate3ReturnData(calls, { [staleToken.toLowerCase()]: 0n })
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected RPC method: ${body.method}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverHeldTokens(1, OWNER)

    expect(result).toEqual([])
  })

  it('skips the Blockscout call entirely for a chain with blockscoutUrl: null and goes straight to fallback', async () => {
    // BSC (56) has blockscoutUrl: null per src/config/chains.ts.
    const { fetchMock, seenUrls } = stubChainFetch({}, 1000000000000000000n)

    const result = await discoverHeldTokens(56, OWNER)

    expect(seenUrls.some(url => url.includes('/api/blockscout'))).toBe(false)
    expect(fetchMock).toHaveBeenCalled()
    // Fallback only checks the native token, and it's nonzero here.
    expect(result).toHaveLength(1)
    expect(result[0].address).toBe(NATIVE_TOKEN_ADDRESS)
    expect(result[0].symbol).toBe('BNB')
    expect(result[0].balance).toBe('1000000000000000000')
  })
})
