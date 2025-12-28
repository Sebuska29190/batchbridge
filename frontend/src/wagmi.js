import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, base, arbitrum } from '@reown/appkit/networks'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

export const BRIDGE_CHAINS = [
    {
        id: 1,
        name: 'Ethereum',
        color: '#627EEA',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    },
    {
        id: 8453,
        name: 'Base',
        color: '#0052FF',
        logo: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    },
    {
        id: 42161,
        name: 'Arbitrum',
        color: '#12AAFF',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    },
]

export const getChainById = (chainId) => BRIDGE_CHAINS.find(c => c.id === Number(chainId))

export const COMMON_TOKENS = {
    1: [
        { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ethereum', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
        { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
        { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png' },
        { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, logo: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
    ],
    8453: [
        { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ethereum', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
        { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png' },
        { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', name: 'Coinbase BTC', decimals: 8, logo: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.png' },
    ],
    42161: [
        { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ethereum', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
        { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
        { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether USD', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
        { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png' },
        { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, logo: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
    ],
}


const networks = [
    {
        ...mainnet,
        rpcUrls: {
            default: { http: ['https://rpc.ankr.com/eth', 'https://eth.llamarpc.com'] }
        }
    },
    {
        ...base,
        rpcUrls: {
            default: { http: ['https://mainnet.base.org', 'https://base.llamarpc.com'] }
        }
    },
    {
        ...arbitrum,
        rpcUrls: {
            default: { http: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'] }
        }
    }
]

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

    // Only show installed/injected wallets
    enableEIP6963: true,
    enableInjected: true,
    enableWalletConnect: false,
    enableCoinbase: false,
    allWallets: 'HIDE',
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
