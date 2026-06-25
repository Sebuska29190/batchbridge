export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const path = req.url.replace('/api/paraswap', '');
        const url = `https://apiv5.paraswap.io${path}`;

        const fetchOpts = {
            method: req.method,
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        };
        if (req.method === 'POST') {
            fetchOpts.body = JSON.stringify(req.body || {});
        }

        const resp = await fetch(url, fetchOpts);
        const data = await resp.json();
        return res.status(resp.ok ? 200 : resp.status).json(data);
    } catch {
        return res.status(500).json({ error: 'Paraswap proxy error' });
    }
}
