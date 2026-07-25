module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()

    try {
        const url = req.url.replace('/api/relay', '')
        const target = `https://api.relay.link${url}`
        const fetchOpts = { method: req.method, headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }
        if (req.method === 'POST') fetchOpts.body = JSON.stringify(req.body || {})
        const resp = await fetch(target, fetchOpts)
        const data = await resp.json()
        return res.status(resp.ok ? 200 : resp.status).json(data)
    } catch {
        return res.status(500).json({ error: 'Relay proxy error' })
    }
}
