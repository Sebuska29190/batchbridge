export default async function handler(req, res) {
    const allowedOrigins = [
        'https://www.batchbridge.xyz/',
        'http://localhost:3000',
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { chainId, address, limit, next } = req.query;

    if (!chainId || !address) {
        return res.status(400).json({ error: 'Missing required parameters: chainId and address' });
    }

    const apiKey = process.env.ROUTESCAN_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        let url = `https://api.routescan.io/v2/network/mainnet/evm/${chainId}/address/${address}/erc20-holdings?limit=${limit || 100}`;
        if (next) {
            url += `&next=${encodeURIComponent(next)}`;
        }

        const response = await fetch(url, {
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Routescan API error: ${response.status}` });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch from Routescan' });
    }
}
