import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/paraswap': {
        target: 'https://apiv5.paraswap.io',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/paraswap', ''),
      },
      '/api/relay': {
        target: 'https://api.relay.link',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/relay', ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          wallet: ['viem', 'wagmi', '@reown/appkit', '@reown/appkit-adapter-wagmi'],
        },
      },
    },
  },
})
