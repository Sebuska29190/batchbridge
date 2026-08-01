export interface ChainConfig {
  id: number
  name: string
  nativeSymbol: string
  logo: string
  explorer: string
  /** At least 2 free RPC endpoints, verified reachable at time of writing. */
  rpcUrls: string[]
  /** Public Blockscout instance for token/balance discovery, if one exists. */
  blockscoutUrl: string | null
  multicall3Address: string
}

/** The canonical Multicall3 deployment address, present on nearly every EVM chain. */
export const STANDARD_MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

/**
 * zkSync Era can't deploy to the standard CREATE2 address (different account
 * abstraction model), so Multicall3 lives at its own address there instead.
 * Source: https://github.com/zkSync-Community-Hub/zksync-developers/discussions/1087
 */
export const ZKSYNC_ERA_CHAIN_ID = 324
const ZKSYNC_ERA_MULTICALL3_ADDRESS = '0xF9cda624FBC7e059355ce98a31693d299FACd963'

/**
 * All RPC and Blockscout URLs below were verified empirically on 2026-08-01
 * (eth_chainId matched the expected chain for every RPC; Blockscout instances
 * checked via /api/v2/blocks). Public endpoints drift over time — if one
 * starts failing consistently, replace it rather than assume it still works.
 *
 * Blockscout coverage gaps confirmed at the same time: BSC, Mantle, Avalanche,
 * Linea and Blast have no working public instance, so blockscoutUrl is null
 * for those five. Token discovery on those chains falls back to multicall
 * (see Task 16). Base's instance answered the block API only 1 of 3 tries in
 * testing — kept since it does work, but treat it as flaky, not solid.
 */
export const CHAINS: ChainConfig[] = [
  {
    id: 1,
    name: 'Ethereum',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    explorer: 'https://etherscan.io',
    rpcUrls: ['https://ethereum.reth.rs/rpc', 'https://ethereum-rpc.publicnode.com'],
    blockscoutUrl: 'https://eth.blockscout.com',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 10,
    name: 'Optimism',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
    explorer: 'https://optimistic.etherscan.io',
    rpcUrls: ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com'],
    blockscoutUrl: 'https://optimism.blockscout.com',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 56,
    name: 'BNB Chain',
    nativeSymbol: 'BNB',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_binance.jpg',
    explorer: 'https://bscscan.com',
    rpcUrls: ['https://56.rpc.thirdweb.com', 'https://bsc-rpc.publicnode.com'],
    blockscoutUrl: null,
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 100,
    name: 'Gnosis',
    nativeSymbol: 'XDAI',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_gnosis.jpg',
    explorer: 'https://gnosisscan.io',
    rpcUrls: ['https://rpc.gnosischain.com', 'https://gnosis-rpc.publicnode.com'],
    blockscoutUrl: 'https://gnosis.blockscout.com',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 137,
    name: 'Polygon',
    nativeSymbol: 'POL',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg',
    explorer: 'https://polygonscan.com',
    rpcUrls: ['https://polygon.drpc.org', 'https://polygon-bor-rpc.publicnode.com'],
    blockscoutUrl: 'https://polygon.blockscout.com',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 250,
    name: 'Fantom',
    nativeSymbol: 'FTM',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_fantom.jpg',
    explorer: 'https://ftmscan.com',
    rpcUrls: ['https://250.rpc.thirdweb.com', 'https://rpc.fantom.network'],
    blockscoutUrl: 'https://explorer.fantom.network',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: ZKSYNC_ERA_CHAIN_ID,
    name: 'zkSync Era',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_zksync%20era.jpg',
    explorer: 'https://explorer.zksync.io',
    rpcUrls: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org'],
    blockscoutUrl: 'https://zksync.blockscout.com',
    multicall3Address: ZKSYNC_ERA_MULTICALL3_ADDRESS,
  },
  {
    id: 5000,
    name: 'Mantle',
    nativeSymbol: 'MNT',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_mantle.jpg',
    explorer: 'https://mantlescan.xyz',
    rpcUrls: ['https://rpc.mantle.xyz', 'https://mantle-rpc.publicnode.com'],
    blockscoutUrl: null,
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 8453,
    name: 'Base',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    explorer: 'https://basescan.org',
    rpcUrls: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    blockscoutUrl: 'https://base.blockscout.com',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 34443,
    name: 'Mode',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_mode.jpg',
    explorer: 'https://modescan.io',
    rpcUrls: ['https://mainnet.mode.network', 'https://mode.drpc.org'],
    blockscoutUrl: 'https://explorer.mode.network',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 42161,
    name: 'Arbitrum',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    explorer: 'https://arbiscan.io',
    rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'],
    blockscoutUrl: 'https://arbitrum.blockscout.com',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 42220,
    name: 'Celo',
    nativeSymbol: 'CELO',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_celo.jpg',
    explorer: 'https://celoscan.io',
    rpcUrls: ['https://forno.celo.org', 'https://celo-rpc.publicnode.com'],
    blockscoutUrl: 'https://celo.blockscout.com',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 43114,
    name: 'Avalanche',
    nativeSymbol: 'AVAX',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg',
    explorer: 'https://snowtrace.io',
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche-c-chain-rpc.publicnode.com'],
    blockscoutUrl: null,
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 59144,
    name: 'Linea',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_linea.jpg',
    explorer: 'https://lineascan.build',
    rpcUrls: ['https://rpc.linea.build', 'https://linea-rpc.publicnode.com'],
    blockscoutUrl: null,
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 81457,
    name: 'Blast',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_blast.jpg',
    explorer: 'https://blastscan.io',
    rpcUrls: ['https://rpc.blast.io', 'https://blast-rpc.publicnode.com'],
    blockscoutUrl: null,
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
  {
    id: 534352,
    name: 'Scroll',
    nativeSymbol: 'ETH',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_scroll.jpg',
    explorer: 'https://scrollscan.com',
    rpcUrls: ['https://rpc.scroll.io', 'https://scroll-rpc.publicnode.com'],
    blockscoutUrl: 'https://blockscout.scroll.io',
    multicall3Address: STANDARD_MULTICALL3_ADDRESS,
  },
]

export const getChainConfig = (chainId: number): ChainConfig | undefined =>
  CHAINS.find(c => c.id === Number(chainId))
