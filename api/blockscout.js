// Whitelist of known Blockscout instances, keyed by chain id. Must stay in
// sync with the blockscoutUrl values in src/config/chains.ts (duplicated
// here rather than imported so this proxy has no build-time dependency on
// app code). Without this whitelist, chainId would let a caller pick an
// arbitrary target host, turning this into an open relay.
const BLOCKSCOUT_HOSTS = {
    1: 'https://eth.blockscout.com',
    10: 'https://optimism.blockscout.com',
    100: 'https://gnosis.blockscout.com',
    137: 'https://polygon.blockscout.com',
    250: 'https://explorer.fantom.network',
    324: 'https://zksync.blockscout.com',
    8453: 'https://base.blockscout.com',
    34443: 'https://explorer.mode.network',
    42161: 'https://arbitrum.blockscout.com',
    42220: 'https://celo.blockscout.com',
    534352: 'https://blockscout.scroll.io',
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const { chainId, path } = req.query
    const host = BLOCKSCOUT_HOSTS[Number(chainId)]
    if (!host) {
        return res.status(400).json({ error: `No Blockscout instance configured for chain ${chainId}` })
    }
    if (typeof path !== 'string' || !path.startsWith('/')) {
        return res.status(400).json({ error: 'path query param is required and must start with /' })
    }

    try {
        const target = `${host}/api/v2${path}`
        const resp = await fetch(target, { headers: { Accept: 'application/json' } })
        const data = await resp.json()
        return res.status(resp.ok ? 200 : resp.status).json(data)
    } catch {
        return res.status(500).json({ error: 'Blockscout proxy error' })
    }
}
