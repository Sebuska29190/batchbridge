import { formatUnits, erc20Abi } from 'viem';

// ═══ API Endpoints ═══
const ONEINCH_API = 'https://api.1inch.dev/swap/v6.0/8453';
const ZEROX_API = 'https://api.0x.org/swap/v1';

// ═══ Base Chain Default Tokens ═══
export const SWAP_TOKENS: Record<string, { address: string; symbol: string; name: string; decimals: number; logo: string }> = {
  'ETH':  { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH',  name: 'Ethereum',    decimals: 18, logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  'USDC': { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin',    decimals: 6,  logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
  'DAI':  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI',  name: 'Dai Stablecoin', decimals: 18, logo: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png' },
  'cbBTC':{ address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC',name: 'Coinbase BTC', decimals: 8,  logo: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.png' },
  'WETH': { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether',decimals: 18, logo: 'https://assets.coingecko.com/coins/images/2518/small/weth.png' },
};

export const SWAP_TOKEN_LIST = Object.values(SWAP_TOKENS);

// ═══ Types ═══
export interface SwapQuote {
  provider: string;
  srcToken: string;
  dstToken: string;
  srcAmount: string;
  dstAmount: string;
  dstAmountFormatted: string;
  priceImpact: string;
  route: string[];
  gas: string;
  gasUsd: string;
  txData?: {
    to: string;
    data: string;
    value: string;
  };
  approvalNeeded?: {
    token: string;
    spender: string;
    amount: string;
  };
}

// ═══ Helpers ═══
const isNative = (addr: string) => addr === '0x0000000000000000000000000000000000000000'
  || addr === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// ═══ 1inch API ═══
async function oneInchQuote(
  srcToken: string, dstToken: string, amount: string, decimals: number,
): Promise<SwapQuote | null> {
  try {
    const src = isNative(srcToken) ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : srcToken;
    const dst = isNative(dstToken) ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : dstToken;
    const amountWei = parseUnits(amount, decimals).toString();
    const url = `${ONEINCH_API}/quote?src=${src}&dst=${dst}&amount=${amountWei}`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      provider: '1inch', srcToken, dstToken, srcAmount: amount,
      dstAmount: data.toAmount || data.dstAmount,
      dstAmountFormatted: formatUnits(BigInt(data.toAmount || data.dstAmount), data.dstToken?.decimals || 18),
      priceImpact: '0', route: (data.protocols || []).slice(0, 3).map((p: any) => p[0]?.name || 'Unknown'),
      gas: data.estimatedGas?.toString() || '0', gasUsd: '0',
    };
  } catch { return null; }
}

async function oneInchSwap(
  srcToken: string, dstToken: string, amount: string, decimals: number,
  from: string, slippage: number,
): Promise<SwapQuote | null> {
  try {
    const src = isNative(srcToken) ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : srcToken;
    const dst = isNative(dstToken) ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : dstToken;
    const amountWei = parseUnits(amount, decimals).toString();
    const url = `${ONEINCH_API}/swap?src=${src}&dst=${dst}&amount=${amountWei}&from=${from}&slippage=${slippage}`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const quote: SwapQuote = {
      provider: '1inch', srcToken, dstToken, srcAmount: amount,
      dstAmount: data.toAmount || data.dstAmount,
      dstAmountFormatted: formatUnits(BigInt(data.toAmount || data.dstAmount), data.dstToken?.decimals || 18),
      priceImpact: '0', route: (data.protocols || []).slice(0, 3).map((p: any) => p[0]?.name || 'Unknown'),
      gas: data.tx?.gas?.toString() || '0', gasUsd: '0',
      txData: { to: data.tx?.to, data: data.tx?.data, value: data.tx?.value || '0' },
    };
    if (data.tx?.from && !isNative(srcToken)) {
      quote.approvalNeeded = { token: srcToken, spender: data.allowanceTarget || data.tx.to, amount: amountWei };
    }
    return quote;
  } catch { return null; }
}

// ═══ 0x Protocol ═══
async function zeroXQuote(
  srcToken: string, dstToken: string, amount: string, decimals: number,
): Promise<SwapQuote | null> {
  try {
    const amountWei = parseUnits(amount, decimals).toString();
    const params = new URLSearchParams({ chainId: '8453', sellToken: srcToken, buyToken: dstToken, sellAmount: amountWei });
    const resp = await fetch(`${ZEROX_API}/quote?${params}`, { headers: { '0x-api-version': 'v2', 'Accept': 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      provider: '0x', srcToken, dstToken, srcAmount: amount,
      dstAmount: data.buyAmount, dstAmountFormatted: formatUnits(BigInt(data.buyAmount), data.buyTokenDecimals || 18),
      priceImpact: '0', route: (data.route?.fills || []).map((f: any) => f.source || 'Unknown'),
      gas: data.transaction?.gas || '0', gasUsd: data.gasUsd || '0',
    };
  } catch { return null; }
}

// ═══ Public API ═══
export async function getBestQuote(
  srcToken: string, dstToken: string, amount: string, decimals: number,
): Promise<SwapQuote | null> {
  if (!amount || parseFloat(amount) <= 0) return null;
  const [oneInchQ, zeroXQ] = await Promise.all([
    oneInchQuote(srcToken, dstToken, amount, decimals),
    zeroXQuote(srcToken, dstToken, amount, decimals),
  ]);
  const quotes = [oneInchQ, zeroXQ].filter(Boolean) as SwapQuote[];
  if (quotes.length === 0) return null;
  quotes.sort((a, b) => (BigInt(b.dstAmount) > BigInt(a.dstAmount) ? 1 : -1));
  return quotes[0];
}

export async function getSwapTransaction(
  srcToken: string, dstToken: string, amount: string, decimals: number,
  from: string, slippage: number,
): Promise<SwapQuote | null> {
  return oneInchSwap(srcToken, dstToken, amount, decimals, from, slippage);
}

export async function getTokenPrice(tokenAddress: string): Promise<number> {
  try {
    const addr = isNative(tokenAddress) ? SWAP_TOKENS['WETH'].address : tokenAddress;
    const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr.toLowerCase()}`);
    const data = await resp.json();
    const pair = data.pairs?.find((p: any) => p.chainId === 'base');
    return pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
  } catch { return 0; }
}

export const SWAP_SLIPPAGE_PRESETS = [
  { label: '0.1%', value: 0.1 },
  { label: '0.5%', value: 0.5 },
  { label: '1.0%', value: 1.0 },
];
