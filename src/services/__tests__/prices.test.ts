import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTokenPrice } from '../prices'

// Each test uses its own fake token address so the module-level 60s price
// cache (which persists across tests in this file) can't leak a result from
// one test into another.
const TOKEN_LIFI_SUCCESS = '0x1111111111111111111111111111111111111111'
const TOKEN_DEXSCREENER_FALLBACK = '0x2222222222222222222222222222222222222222'
const TOKEN_BOTH_FAIL = '0x3333333333333333333333333333333333333333'
const TOKEN_CACHED = '0x4444444444444444444444444444444444444444'

describe('getTokenPrice', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed price from LI.FI on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toBe(`/api/lifi/token?chain=8453&token=${TOKEN_LIFI_SUCCESS}`)
      return new Response(JSON.stringify({ priceUSD: '0.9998' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const price = await getTokenPrice(8453, TOKEN_LIFI_SUCCESS)
    expect(price).toBeCloseTo(0.9998, 6)
  })

  it('falls through to DexScreener (highest-liquidity pair) when LI.FI fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/lifi/')) {
        return new Response(JSON.stringify({ message: 'not found' }), { status: 404 })
      }
      if (url.startsWith('https://api.dexscreener.com/')) {
        return new Response(JSON.stringify({
          schemaVersion: '1.0.0',
          pairs: [
            { chainId: 'base', priceUsd: '0.50', liquidity: { usd: 1000 } },
            { chainId: 'base', priceUsd: '0.9999', liquidity: { usd: 151252.4 } },
            { chainId: 'polygon', priceUsd: '99', liquidity: { usd: 9_000_000 } },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const price = await getTokenPrice(8453, TOKEN_DEXSCREENER_FALLBACK)
    expect(price).toBeCloseTo(0.9999, 6)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when both LI.FI and DexScreener fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))

    const price = await getTokenPrice(8453, TOKEN_BOTH_FAIL)
    expect(price).toBeNull()
  })

  it('does not trigger a second fetch for a price cached within 60s', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ priceUSD: '1.23' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const first = await getTokenPrice(8453, TOKEN_CACHED)
    const second = await getTokenPrice(8453, TOKEN_CACHED)

    expect(first).toBeCloseTo(1.23, 6)
    expect(second).toBeCloseTo(1.23, 6)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
