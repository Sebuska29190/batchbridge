import crypto from 'crypto'

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()

    const apiKey = process.env.OKX_API_KEY
    const secret = process.env.OKX_SECRET_KEY
    const passphrase = process.env.OKX_PASSPHRASE

    if (!apiKey || !secret || !passphrase) {
        return res.status(200).json({ error: 'OKX API not configured', configured: false, data: [] })
    }

    const ts = new Date().toISOString()
    const method = req.method
    const path = req.url.replace('/api/okx', '/api/v6/dex/aggregator')
    const body = method === 'POST' ? JSON.stringify(req.body || {}) : ''

    const signMsg = ts + method + path + body
    const sign = crypto.createHmac('sha256', secret).update(signMsg).digest('base64')

    const headers = {
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': sign,
        'OK-ACCESS-TIMESTAMP': ts,
        'OK-ACCESS-PASSPHRASE': passphrase,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }

    try {
        const url = `https://web3.okx.com${path}`
        const fetchOpts = { method, headers }
        if (method === 'POST') fetchOpts.body = body

        const resp = await fetch(url, fetchOpts)
        const data = await resp.json()
        return res.status(resp.ok ? 200 : resp.status).json(data)
    } catch {
        return res.status(500).json({ error: 'OKX API error' })
    }
}
