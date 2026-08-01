import { describe, it, expect } from 'vitest'
import { CHAINS, ZKSYNC_ERA_CHAIN_ID, STANDARD_MULTICALL3_ADDRESS } from '../chains'

describe('CHAINS', () => {
  it('defines exactly 16 chains', () => {
    expect(CHAINS).toHaveLength(16)
  })

  it('every chain has at least 2 RPC URLs', () => {
    for (const chain of CHAINS) {
      expect(chain.rpcUrls.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('every chain has a valid multicall3 address, zkSync Era using its own', () => {
    for (const chain of CHAINS) {
      expect(chain.multicall3Address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      if (chain.id === ZKSYNC_ERA_CHAIN_ID) {
        expect(chain.multicall3Address.toLowerCase()).not.toBe(STANDARD_MULTICALL3_ADDRESS.toLowerCase())
      } else {
        expect(chain.multicall3Address.toLowerCase()).toBe(STANDARD_MULTICALL3_ADDRESS.toLowerCase())
      }
    }
  })

  it('has no duplicate chain ids', () => {
    const ids = CHAINS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every RPC URL is https', () => {
    for (const chain of CHAINS) {
      for (const url of chain.rpcUrls) {
        expect(url.startsWith('https://')).toBe(true)
      }
    }
  })
})
