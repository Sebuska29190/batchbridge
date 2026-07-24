import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, base, arbitrum, optimism, polygon } from '@reown/appkit/networks'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '325945c5d9c3e17d63051ef29c81bffa'

export const CHAINS = [
  { id: 1, name: 'Ethereum', color: '#627EEA', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png', explorer: 'https://etherscan.io' },
  { id: 8453, name: 'Base', color: '#0052FF', logo: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg', explorer: 'https://basescan.org' },
  { id: 42161, name: 'Arbitrum', color: '#12AAFF', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png', explorer: 'https://arbiscan.io' },
  { id: 10, name: 'Optimism', color: '#FF0420', logo: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg', explorer: 'https://optimistic.etherscan.io' },
  { id: 137, name: 'Polygon', color: '#8247E5', logo: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg', explorer: 'https://polygonscan.com' },
]

export const COMMON_TOKENS: Record<number, { address: string; symbol: string; name: string; decimals: number; logo: string }[]> = {
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
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/2518/small/weth.png' },
  ],
  42161: [
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ethereum', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether USD', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png' },
  ],
  10: [
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ethereum', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether USD', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
  ],
  137: [
    { address: '0x0000000000000000000000000000000000000000', symbol: 'MATIC', name: 'Polygon', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png' },
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6, logo: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
  ],
}

const networks = [
  { ...mainnet, rpcUrls: { default: { http: ['https://rpc.ankr.com/eth', 'https://eth.llamarpc.com'] } } },
  { ...base, rpcUrls: { default: { http: ['https://mainnet.base.org', 'https://base.llamarpc.com'] } } },
  { ...arbitrum, rpcUrls: { default: { http: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'] } } },
  { ...optimism, rpcUrls: { default: { http: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com'] } } },
  { ...polygon, rpcUrls: { default: { http: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com'] } } },
]

const metadata = {
  name: 'BatchBridge',
  description: 'Multi-Chain DEX & Bridge — Swap and bridge tokens across 20+ chains',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://batchbridge.xyz',
  icons: ['https://www.batchbridge.xyz/favicon.png'],
}

export const wagmiAdapter = new WagmiAdapter({ networks, projectId, ssr: false })

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  enableEIP6963: true,
  enableInjected: true,
  enableWalletConnect: true,
  enableCoinbase: true,
  allWallets: 'SHOW',
  themeMode: 'dark',
  features: { analytics: false, swaps: false, onramp: false, email: false, socials: false },
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
