import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTokenHoldings } from '../../bridgeService'

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
