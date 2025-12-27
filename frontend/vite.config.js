import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import nodePolyfills from 'rollup-plugin-polyfill-node'

const MODE = process.env.NODE_ENV
const development = MODE === 'development'

export default defineConfig({
    plugins: [
        react(),
        development && nodePolyfills({
            include: ['node_modules/**/*.js', new RegExp('node_modules/.vite/.*js')],
            http: true,
            crypto: true
        })
    ],
    server: {
        host: '0.0.0.0',
        port: 3000,
        strictPort: false,
        hmr: {
            host: 'localhost',
        },
        proxy: {
            '/api/routescan': {
                target: 'https://api.routescan.io',
                changeOrigin: true,
                rewrite: (path) => {
                    const url = new URL(path, 'http://localhost');
                    const chainId = url.searchParams.get('chainId');
                    const address = url.searchParams.get('address');
                    const limit = url.searchParams.get('limit') || '100';
                    const next = url.searchParams.get('next');
                    let apiPath = `/v2/network/mainnet/evm/${chainId}/address/${address}/erc20-holdings?limit=${limit}`;
                    if (next) apiPath += `&next=${encodeURIComponent(next)}`;
                    return apiPath;
                },
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq) => {
                        const apiKey = process.env.ROUTESCAN_API_KEY;
                        if (apiKey) {
                            proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
                        }
                    });
                },
            },
        },
    },
    resolve: {
        alias: {
            crypto: 'crypto-browserify',
            stream: 'stream-browserify',
            assert: 'assert'
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            plugins: [nodePolyfills({ crypto: true, http: true })]
        },
        commonjsOptions: {
            transformMixedEsModules: true
        }
    }
})
