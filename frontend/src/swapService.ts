import { createPublicClient, http, erc20Abi, formatUnits, parseUnits } from 'viem';
import { base } from 'viem/chains';

// ═══ ParaSwap API (free, no key) ═══
const PARASWAP_API = 'https://apiv5.paraswap.io';
const BASE_CHAIN_ID = 8453;

// ═══ Tokens ═══
export interface SwapToken {
  address: string; symbol: string; name: string; decimals: number; logo: string;
}
export const SWAP_TOKENS: SwapToken[] = [
  { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH',  name: 'Ethereum',       decimals: 18, logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin',       decimals: 6,  logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI',  name: 'Dai Stablecoin',  decimals: 18, logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png' },
  { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC',name: 'Coinbase BTC',   decimals: 8,  logo: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.png' },
  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether',   decimals: 18, logo: 'https://assets.coingecko.com/coins/images/2518/small/weth.png' },
];

export const SWAP_SLIPPAGE_PRESETS = [
  { label: '0.1%', value: 0.1 },
  { label: '0.5%', value: 0.5 },
  { label: '1.0%', value: 1.0 },
];

const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

function isNative(addr: string) { return addr === '0x0000000000000000000000000000000000000000'; }

// ═══ Balance ═══
export async function fetchBalance(address: `0x${string}`, token: SwapToken): Promise<string> {
  try {
    if (isNative(token.address)) {
      const bal = await publicClient.getBalance({ address });
      return formatUnits(bal, 18);
    }
    const bal = await publicClient.readContract({
      address: token.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [address],
    });
    return formatUnits(bal, token.decimals);
  } catch { return '0'; }
}

export async function fetchAllBalances(address: `0x${string}`): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(SWAP_TOKENS.map(async t => {
    results[t.address] = await fetchBalance(address, t);
  }));
  return results;
}

// ═══ Quote ═══
export interface SwapQuote {
  provider: string; srcToken: string; dstToken: string; srcAmount: string;
  dstAmount: string; dstAmountFormatted: string; route: string[];
  gas: string; gasUsd: string; priceImpact: string;
  txData?: { to: `0x${string}`; data: `0x${string}`; value: bigint };
}

export async function getQuote(
  srcToken: SwapToken, dstToken: SwapToken, amount: string,
): Promise<SwapQuote | null> {
  try {
    const srcAmountWei = parseUnits(amount, srcToken.decimals).toString();
    const params = new URLSearchParams({
      srcToken: srcToken.address,
      destToken: dstToken.address,
      srcDecimals: srcToken.decimals.toString(),
      destDecimals: dstToken.decimals.toString(),
      amount: srcAmountWei,
      side: 'SELL',
      network: BASE_CHAIN_ID.toString(),
      partner: 'batchswap',
    });

    const resp = await fetch(`${PARASWAP_API}/prices?${params}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    const pr = data.priceRoute;
    if (!pr) return null;

    const exchanges = pr.bestRoute?.[0]?.swaps?.flatMap((s: any) =>
      s.swapExchanges?.map((e: any) => e.exchange) || []
    ) || [];

    return {
      provider: 'ParaSwap',
      srcToken: srcToken.address, dstToken: dstToken.address, srcAmount: amount,
      dstAmount: pr.destAmount,
      dstAmountFormatted: formatUnits(BigInt(pr.destAmount), dstToken.decimals),
      route: [...new Set(exchanges)],
      gas: pr.gasCost || '0', gasUsd: pr.gasCostUSD || '$0', priceImpact: '0',
    };
  } catch { return null; }
}

export async function getSwapTx(
  srcToken: SwapToken, dstToken: SwapToken, amount: string, from: `0x${string}`, slippage: number,
): Promise<SwapQuote | null> {
  try {
    const srcAmountWei = parseUnits(amount, srcToken.decimals).toString();
    const body = {
      srcToken: srcToken.address, destToken: dstToken.address,
      srcDecimals: srcToken.decimals, destDecimals: dstToken.decimals,
      srcAmount: srcAmountWei, userAddress: from, slippage: Math.floor(slippage * 100),
      network: BASE_CHAIN_ID, side: 'SELL', partner: 'batchswap',
    };

    const resp = await fetch(`${PARASWAP_API}/transactions/${BASE_CHAIN_ID}?ignoreChecks=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    return {
      provider: 'ParaSwap', srcToken: srcToken.address, dstToken: dstToken.address,
      srcAmount: amount, dstAmount: data.destAmount || '0',
      dstAmountFormatted: formatUnits(BigInt(data.destAmount || '0'), dstToken.decimals),
      route: [], gas: data.gas || '0', gasUsd: '0', priceImpact: '0',
      txData: { to: data.to as `0x${string}`, data: data.data as `0x${string}`, value: BigInt(data.value || '0') },
    };
  } catch { return null; }
}
