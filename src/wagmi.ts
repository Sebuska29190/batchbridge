import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { CHAINS } from './config/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

export const getChainById = (chainId: number) => CHAINS.find(c => c.id === Number(chainId))

// All 16 configured chains, mapped to the network shape AppKit/wagmi expect.
// Built from src/config/chains.ts (the single source of chain metadata) so
// wallet connect/switch-chain coverage always matches the app's own chain
// list instead of a separately-maintained 3-chain subset.
interface NetworkConfig {
    id: number
    name: string
    nativeCurrency: { name: string; symbol: string; decimals: number }
    rpcUrls: { default: { http: string[] } }
    blockExplorers: { default: { name: string; url: string } }
}

// CHAINS is statically known to be non-empty; the cast satisfies AppKit's
// `[AppKitNetwork, ...AppKitNetwork[]]` tuple requirement, which a plain
// `.map()` result can't express on its own.
const networks = CHAINS.map(chain => ({
    id: chain.id,
    name: chain.name,
    nativeCurrency: { name: chain.nativeSymbol, symbol: chain.nativeSymbol, decimals: 18 },
    rpcUrls: {
        default: { http: chain.rpcUrls }
    },
    blockExplorers: {
        default: { name: chain.name, url: chain.explorer }
    },
})) as [NetworkConfig, ...NetworkConfig[]]

const metadata = {
    name: 'BatchBridge',
    description: 'Bridge multiple tokens across Ethereum, Base, and Arbitrum in a single batch transaction',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://batchbridge.vercel.app',
    icons: ['https://www.batchbridge.xyz/favicon.png']
}

export const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: false
})

createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,

    // Mobile wallet compatibility - enable all major wallet providers
    enableEIP6963: true,
    enableInjected: true,
    enableWalletConnect: true,  // Essential for mobile wallets (MetaMask Mobile, Trust, Rainbow, etc.)
    enableCoinbase: true,       // Popular mobile wallet
    allWallets: 'SHOW',         // Show all available wallets for mobile users
    themeMode: 'dark',

    features: {
        analytics: false,
        swaps: false,
        onramp: false,
        email: false,
        socials: false,
        emailShowWallets: false,
    }
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
