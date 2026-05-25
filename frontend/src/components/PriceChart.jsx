import { useState, useEffect } from 'react'

// Mini price chart using GeckoTerminal simple API
export default function PriceChart({ token, chainId }) {
  const [prices, setPrices] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token?.address || !chainId) return
    if (token.address === '0x0000000000000000000000000000000000000000') return // native token

    let cancelled = false
    setLoading(true)

    const networkMap = {
      1: 'eth', 8453: 'base', 42161: 'arbitrum',
      10: 'oeth', 137: 'polygon'
    }
    const network = networkMap[chainId]
    if (!network) { setLoading(false); return }

    fetch(`https://api.geckoterminal.com/api/v2/simple/networks/${network}/tokens/${token.address}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        if (data?.data?.attributes?.price_change_percentage) {
          setPrices(data.data.attributes)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [token?.address, chainId])

  if (loading) return <div className="chart-placeholder">Loading...</div>
  if (!prices) return null

  const changes = [
    { label: '5m', value: prices.price_change_percentage['5m'] },
    { label: '1h', value: prices.price_change_percentage['1h'] },
    { label: '6h', value: prices.price_change_percentage['6h'] },
    { label: '24h', value: prices.price_change_percentage['24h'] },
  ]

  return (
    <div className="price-chart">
      {changes.map(c => {
        const isUp = (c.value || 0) >= 0
        return (
          <div key={c.label} className="price-change">
            <span className="price-label">{c.label}</span>
            <span className={`price-pct ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : ''}{c.value?.toFixed(2) || '0.00'}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
