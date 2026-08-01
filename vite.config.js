import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import nodePolyfills from 'rollup-plugin-polyfill-node'

const MODE = process.env.NODE_ENV
const development = MODE === 'development'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
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
        // Mobile performance optimizations - use esbuild (default, faster)
        minify: 'esbuild',
        rollupOptions: {
            plugins: [nodePolyfills({ crypto: true, http: true })],
            output: {
                // Better chunk splitting for mobile performance
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    wallet: ['viem', 'wagmi', '@reown/appkit', '@reown/appkit-adapter-wagmi'],
                    query: ['@tanstack/react-query']
                },
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        },
        commonjsOptions: {
            transformMixedEsModules: true
        },
        // Build size reporting
        reportCompressedSize: true,
        chunkSizeWarningLimit: 1000
    }
})
