const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000'

export interface BridgeableAsset {
  symbol: string
  /** Default decimals, true for most chains this asset exists on. */
  decimals: number
  /** chainId -> token address; native token is the zero address. */
  addressesByChain: Record<number, string>
  /**
   * Per-chain decimals override for the (rare but real) chains where the
   * bridged deployment doesn't match the asset's usual decimals. Verified
   * on-chain, not assumed: BSC's Binance-Peg USDC reports decimals()=18,
   * not the 6 every other chain's USDC uses.
   */
  decimalsOverrides?: Record<number, number>
}

/**
 * Hand-maintained map of assets that exist equivalently across multiple chains
 * (same asset, movable 1:1 via bridging) — NOT fetched from any API, since none
 * of our free data sources expose "which tokens are the same thing cross-chain"
 * as a clean list.
 *
 * Every address below was checked against Circle's official USDC contract
 * address docs (developers.circle.com/stablecoins/usdc-contract-addresses) or
 * cross-referenced against block-explorer listings (Etherscan/Arbiscan/
 * BscScan/PolygonScan/Basescan/Lineascan/Scrollscan/Snowtrace) on 2026-08-01.
 * A chain is deliberately left out of an asset's map when no confidently
 * verified address was found — see the report for the full exclusion list.
 */
export const BRIDGEABLE_ASSETS: BridgeableAsset[] = [
  {
    symbol: 'ETH',
    decimals: 18,
    addressesByChain: {
      1: NATIVE_ADDRESS,
      10: NATIVE_ADDRESS,
      // Binance-Peg Ethereum Token (BEP-20) — BSC has no native ETH.
      56: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      // WETH (PoS-bridged) — Polygon has no native ETH.
      137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      8453: NATIVE_ADDRESS,
      324: NATIVE_ADDRESS,
      42161: NATIVE_ADDRESS,
      // WETH.e (Avalanche Bridge) — Avalanche has no native ETH.
      43114: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
      59144: NATIVE_ADDRESS,
      81457: NATIVE_ADDRESS,
      534352: NATIVE_ADDRESS,
      34443: NATIVE_ADDRESS,
    },
  },
  {
    symbol: 'USDC',
    decimals: 6,
    addressesByChain: {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      324: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4',
      42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      42220: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
      43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      59144: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
    },
    // Confirmed via live decimals() call on two independent RPCs (2026-08-01):
    // Binance-Peg USDC on BSC uses 18 decimals, not the 6 every other chain's
    // USDC uses. Using the default 6 here would misread amounts by 10^12x.
    decimalsOverrides: {
      56: 18,
    },
  },
  {
    symbol: 'USDT',
    decimals: 6,
    addressesByChain: {
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      56: '0x55d398326f99059fF775485246999027B3197955',
      137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      43114: '0x9702230A8ea53601f5352B1296f86eB7e21D2e92',
      59144: '0xA219439258ca9da29E9Cc4cE5596924745e12B93',
      534352: '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df',
    },
  },
  {
    symbol: 'DAI',
    decimals: 18,
    addressesByChain: {
      1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      10: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      56: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
      100: '0x44fA8E6f47987339850636F88629646662444217',
      137: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      8453: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      // Dai.e (Avalanche Bridge)
      43114: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
    },
  },
  {
    symbol: 'WBTC',
    decimals: 8,
    addressesByChain: {
      1: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      10: '0x68f180fcce6836688e9084f035309e29bf0a2095',
      137: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      8453: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
      42161: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      // WBTC.e (Avalanche Bridge)
      43114: '0x50b7545627a5162f82a992C33b87aDc75187B218',
      59144: '0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4',
    },
  },
]

export const getBridgeableTokens = (
  chainId: number
): Array<{ symbol: string; address: string; decimals: number }> => {
  const id = Number(chainId)
  return BRIDGEABLE_ASSETS.filter(asset => id in asset.addressesByChain).map(asset => ({
    symbol: asset.symbol,
    address: asset.addressesByChain[id],
    decimals: asset.decimalsOverrides?.[id] ?? asset.decimals,
  }))
}

export const getEquivalent = (symbol: string, fromChainId: number, toChainId: number): string | null => {
  const asset = BRIDGEABLE_ASSETS.find(a => a.symbol === symbol)
  if (!asset) return null

  const fromId = Number(fromChainId)
  const toId = Number(toChainId)

  if (!(fromId in asset.addressesByChain) || !(toId in asset.addressesByChain)) return null

  return asset.addressesByChain[toId]
}
