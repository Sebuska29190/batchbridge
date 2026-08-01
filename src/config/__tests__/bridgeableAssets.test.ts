import { describe, it, expect } from 'vitest'
import { BRIDGEABLE_ASSETS, getBridgeableTokens, getEquivalent } from '../bridgeableAssets'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000'

describe('BRIDGEABLE_ASSETS', () => {
  it('every address in every chain map is a valid hex address or the native zero-address', () => {
    for (const asset of BRIDGEABLE_ASSETS) {
      for (const address of Object.values(asset.addressesByChain)) {
        expect(address === NATIVE_ADDRESS || ADDRESS_RE.test(address)).toBe(true)
      }
    }
  })

  it('covers the canonical symbols', () => {
    const symbols = BRIDGEABLE_ASSETS.map(a => a.symbol)
    expect(symbols).toContain('ETH')
    expect(symbols).toContain('USDC')
    expect(symbols).toContain('USDT')
    expect(symbols).toContain('DAI')
    expect(symbols).toContain('WBTC')
  })
})

describe('getBridgeableTokens', () => {
  it('returns every asset that exists on the given chain', () => {
    const tokens = getBridgeableTokens(8453)
    const symbols = tokens.map(t => t.symbol)
    expect(symbols).toContain('ETH')
    expect(symbols).toContain('USDC')
    expect(symbols).toContain('DAI')
    expect(symbols).toContain('WBTC')
  })

  it('returns an empty array for a chain none of the assets cover', () => {
    expect(getBridgeableTokens(999999)).toEqual([])
  })

  it('uses the per-chain decimals override for BSC USDC (18, not the usual 6)', () => {
    // Confirmed live on-chain (two independent RPCs, 2026-08-01): Binance-Peg
    // USDC on BSC reports decimals()=18. Using the default 6 would misread
    // every BSC USDC amount by a factor of 10^12.
    const tokens = getBridgeableTokens(56)
    const usdc = tokens.find(t => t.symbol === 'USDC')
    expect(usdc?.decimals).toBe(18)
  })

  it('uses the default decimals for USDC on chains without an override', () => {
    const tokens = getBridgeableTokens(8453)
    const usdc = tokens.find(t => t.symbol === 'USDC')
    expect(usdc?.decimals).toBe(6)
  })
})

describe('getEquivalent', () => {
  it('returns the real Arbitrum USDC address for Base -> Arbitrum', () => {
    expect(getEquivalent('USDC', 8453, 42161)).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831')
  })

  it('returns null when the asset does not exist on one side of the pair', () => {
    // WBTC has no confirmed entry for BSC (56) in the map.
    expect(getEquivalent('WBTC', 8453, 56)).toBeNull()
  })

  it('returns null for an unknown symbol', () => {
    expect(getEquivalent('NOTASYMBOL', 8453, 42161)).toBeNull()
  })
})
