import { mainnet, base, arbitrum } from 'viem/chains';
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { getChainById } from './wagmi';

export { RELAY_ERROR_CODES, getRelayErrorMessage } from './services/errors';
export { detectTransferFeeToken, detectTransferFeeTokensBatch } from './services/transferFee';
export {
    filterApproveStepsByAllowance,
    submitRelaySignature,
    pollBridgeStatus,
    isUserRejection,
} from './services/execution';

const RELAY_API_BASE = 'https://api.relay.link';
const PUBLIC_RPC_URLS = {
    1: ['https://rpc.ankr.com/eth', 'https://eth.llamarpc.com'],
    8453: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
    42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
};

const getPublicClient = (chainId) => {
    const chainNumeric = Number(chainId);
    const chainInfo = getChainById(chainNumeric);
    if (!chainInfo) throw new Error(`Unsupported chain ID: ${chainId}`);

    const rpcUrls = PUBLIC_RPC_URLS[chainNumeric];
    const rpcUrl = rpcUrls?.[0];
    if (!rpcUrl) {
        throw new Error(`No RPC configured for chain ${chainId}`);
    }

    const viemChain = chainNumeric === 1 ? mainnet : chainNumeric === 8453 ? base : arbitrum;

    return createPublicClient({
        chain: viemChain,
        transport: http(rpcUrl, { batch: true }),
        batch: {
            multicall: true,
        },
    });
};

const detectSmartWalletCapabilities = (capabilities) => Boolean(
    capabilities?.atomicBatch?.supported ||
    capabilities?.paymasterService?.supported ||
    capabilities?.auxiliaryFunds?.supported ||
    capabilities?.sessionKeys?.supported
);

export const resolveExplicitDeposit = async ({ walletClient, address, chainId }) => {
    const fallback = {
        explicitDeposit: true,
        supportsAtomicBatch: true,
        isSmartWallet: false,
        isEip7702Delegated: false,
        hasSmartWalletCapabilities: false,
    };

    if (!address || !chainId) {
        return fallback;
    }

    let hasSmartWalletCapabilities = false;
    let supportsAtomicBatch = true;
    let capabilitiesChecked = false;
    const account = walletClient?.account?.address || walletClient?.account || address;

    try {
        if (walletClient?.getCapabilities && account) {
            const capabilities = await walletClient.getCapabilities({
                account,
                chainId: Number(chainId),
            });
            capabilitiesChecked = true;
            hasSmartWalletCapabilities = detectSmartWalletCapabilities(capabilities);
            if (capabilities && Object.prototype.hasOwnProperty.call(capabilities, 'atomicBatch')) {
                supportsAtomicBatch = Boolean(capabilities?.atomicBatch?.supported);
            }
        }
    } catch { }

    let isEip7702Delegated = false;
    let hasCode = false;
    let codeChecked = false;
    let explicitDeposit = true;

    const publicClient = getPublicClient(chainId);

    try {
        const [code, nativeBalance, txCount] = await Promise.all([
            publicClient.getCode({ address }),
            publicClient.getBalance({ address }),
            publicClient.getTransactionCount({ address }),
        ]);

        codeChecked = true;
        const normalizedCode = typeof code === 'string' ? code.toLowerCase() : '';
        hasCode = Boolean(normalizedCode && normalizedCode !== '0x');
        isEip7702Delegated = Boolean(normalizedCode && normalizedCode.startsWith('0xef01'));

        const isSmartWallet = hasSmartWalletCapabilities || hasCode || isEip7702Delegated;
        if (codeChecked && !hasCode && !isEip7702Delegated && (!capabilitiesChecked || !hasSmartWalletCapabilities)) {
            explicitDeposit = false;
        }

        if (nativeBalance === 0n || txCount <= 1) {
            explicitDeposit = true;
        }

        return {
            explicitDeposit,
            supportsAtomicBatch,
            isSmartWallet,
            isEip7702Delegated,
            hasSmartWalletCapabilities,
        };
    } catch (error) {
        return {
            explicitDeposit: true,
            supportsAtomicBatch,
            isSmartWallet: hasSmartWalletCapabilities,
            isEip7702Delegated: false,
            hasSmartWalletCapabilities,
        };
    }
};

const isValidAddress = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const fetchTokenMetadata = async (chainId, tokenAddress) => {
    if (!isValidAddress(tokenAddress)) {
        throw new Error('Invalid address format');
    }

    try {
        const response = await fetch(`${RELAY_API_BASE}/currencies/v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chainIds: [Number(chainId)],
                address: tokenAddress.toLowerCase(),
                defaultList: false,
                limit: 1,
                useExternalSearch: true,
                referrer: 'relay.link',
            }),
        });

        if (!response.ok) {
            throw new Error(`Relay API error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Token not found on this network');
        }

        const token = data[0];

        return {
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            chainId: Number(chainId),
            logo: token.metadata?.logoURI || null,
            verified: token.metadata?.verified || false,
            isCustom: true,
        };
    } catch (error) {
        throw new Error(error.message || 'Token not found or invalid on this network');
    }
};

export const fetchTokenBalance = async (chainId, tokenAddress, ownerAddress) => {
    const publicClient = getPublicClient(chainId);
    const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [ownerAddress],
    });

    return balance.toString();
};



// TODO(Task 16, Faza 2): rebuild on free Blockscout API + on-chain multicall
// verification. Previously backed by Routescan, a paid API — removed
// outright rather than left wired to a key-gated service. Stubbed to
// return no holdings until the free replacement lands.
export const fetchTokenHoldings = async (address, chainId) => {
    const chainInfo = getChainById(chainId);
    if (!chainInfo) {
        throw new Error(`Unsupported chain: ${chainId}`);
    }

    return [];
};

const routeCache = new Map();
const ROUTE_CACHE_TTL = 5 * 60 * 1000;
const relayPriceCache = new Map();
const RELAY_PRICE_CACHE_TTL = 5 * 60 * 1000;

export const MAX_PRICE_IMPACT = 15;

const normalizeRelayEndpoint = (endpoint) => {
    if (!endpoint) return null;
    if (endpoint.startsWith('http')) return endpoint;
    if (endpoint.startsWith('/')) return `${RELAY_API_BASE}${endpoint}`;
    return `${RELAY_API_BASE}/${endpoint}`;
};

const buildRelayError = async (response, fallbackMessage) => {
    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    const message = data.message || fallbackMessage;
    const error = new Error(message);
    if (data.errorCode) error.code = data.errorCode;
    if (data.errorData) error.errorData = data.errorData;
    if (data.requestId) error.requestId = data.requestId;
    return error;
};

const fetchRelayTokenPrice = async (chainId, tokenAddress) => {
    const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`;
    const cached = relayPriceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < RELAY_PRICE_CACHE_TTL) {
        return cached.price;
    }

    try {
        const response = await fetch(
            `${RELAY_API_BASE}/currencies/token/price?address=${tokenAddress}&chainId=${Number(chainId)}&referrer=relay.link`
        );
        if (!response.ok) {
            throw new Error(`Relay price failed: ${response.status}`);
        }
        const data = await response.json();
        const price = Number(data?.price || 0);
        relayPriceCache.set(cacheKey, { price, timestamp: Date.now() });
        return price;
    } catch (error) {
        relayPriceCache.set(cacheKey, { price: null, timestamp: Date.now() });
        return null;
    }
};

export const applyRelayPriceToToken = async (token, chainId) => {
    const relayPrice = await fetchRelayTokenPrice(chainId, token.address);
    if (!relayPrice || relayPrice <= 0) {
        return token;
    }

    let amount = 0;
    try {
        const decimals = Number.isFinite(Number(token.decimals)) ? Number(token.decimals) : 18;
        amount = Number(formatUnits(BigInt(token.balance || '0'), decimals));
    } catch {
        amount = 0;
    }

    const valueUsd = amount * relayPrice;
    return {
        ...token,
        price: relayPrice,
        valueUsd,
    };
};

const cleanExpiredCache = () => {
    const now = Date.now();
    for (const [key, value] of routeCache.entries()) {
        if (now - value.timestamp >= ROUTE_CACHE_TTL) {
            routeCache.delete(key);
        }
    }
    for (const [key, value] of relayPriceCache.entries()) {
        if (now - value.timestamp >= RELAY_PRICE_CACHE_TTL) {
            relayPriceCache.delete(key);
        }
    }
    // transferFeeCache now lives in and trims itself in services/transferFee.ts.
};

export const checkRouteAvailability = async (originChainId, destChainId, tokenAddress, userAddress, decimals = 18, destinationCurrency = '0x0000000000000000000000000000000000000000') => {
    const cacheKey = `${originChainId}-${destChainId}-${tokenAddress.toLowerCase()}-${destinationCurrency.toLowerCase()}`;
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ROUTE_CACHE_TTL) {
        return cached.result;
    }

    try {
        const decimalsInt = Number.isFinite(Number(decimals)) ? Number(decimals) : 18;
        const normalizedDecimals = decimalsInt >= 0 ? decimalsInt : 18;
        const oneToken = (BigInt(10) ** BigInt(normalizedDecimals)).toString();

        const response = await fetch(`${RELAY_API_BASE}/price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: userAddress,
                originChainId: Number(originChainId),
                destinationChainId: Number(destChainId),
                originCurrency: tokenAddress,
                destinationCurrency: destinationCurrency,
                amount: oneToken,
                tradeType: 'EXACT_INPUT',
            }),
        });

        let result;
        if (!response.ok) {
            result = { available: false, reason: 'Route not supported' };
        } else {
            const data = await response.json();
            result = { available: true, data };
        }

        routeCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    } catch (error) {
        const result = { available: false, reason: error.message };
        routeCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    }
};

export const checkRoutesAvailability = async (originChainId, destChainId, tokens, userAddress, destinationCurrency = '0x0000000000000000000000000000000000000000') => {
    cleanExpiredCache();

    const results = await Promise.allSettled(
        tokens.map(token => checkRouteAvailability(
            originChainId,
            destChainId,
            token.address,
            userAddress,
            token.decimals ?? 18,
            destinationCurrency
        ))
    );

    const checked = tokens.map((token, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
            return { ...token, routeAvailable: result.value.available };
        }
        return { ...token, routeAvailable: false };
    });

    return checked;
};

export const formatBalance = (balance, decimals) => {
    if (!balance) return '0';
    const decimalsInt = Number.isFinite(Number(decimals)) ? Number(decimals) : 18;
    const normalized = formatUnits(BigInt(balance), decimalsInt);
    const num = Number(normalized);
    if (!Number.isFinite(num) || num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
    return (num / 1000000).toFixed(2) + 'M';
};

export const formatUsd = (value) => {
    if (!value || value === 0) return '$0.00';
    if (value < 0.01) return '<$0.01';
    if (value < 1) return '$' + value.toFixed(2);
    if (value < 1000) return '$' + value.toFixed(2);
    if (value < 1000000) return '$' + (value / 1000).toFixed(2) + 'K';
    return '$' + (value / 1000000).toFixed(2) + 'M';
};

export const getBridgeQuote = async ({
    user,
    originChainId,
    destinationChainId,
    originCurrency,
    destinationCurrency,
    amount,
    recipient,
    slippageTolerance = null,
    includedSwapSources = null,
    excludedSwapSources = null,
    explicitDeposit = true,
    useFallbacks = false,
    useExternalLiquidity = false,
    usePermit = false,
}) => {
    const requestBody = {
        user,
        originChainId: Number(originChainId),
        destinationChainId: Number(destinationChainId),
        originCurrency,
        destinationCurrency,
        amount,
        recipient: recipient || user,
        tradeType: 'EXACT_INPUT',
        referrer: 'relay.link',
        useDepositAddress: false,
        topupGas: false,
    };

    if (explicitDeposit !== null && explicitDeposit !== undefined) {
        requestBody.explicitDeposit = explicitDeposit;
    }
    if (slippageTolerance !== null) {
        requestBody.slippageTolerance = String(slippageTolerance);
    }
    if (Array.isArray(includedSwapSources) && includedSwapSources.length > 0) {
        requestBody.includedSwapSources = includedSwapSources;
    }
    if (Array.isArray(excludedSwapSources) && excludedSwapSources.length > 0) {
        requestBody.excludedSwapSources = excludedSwapSources;
    }
    if (useFallbacks) {
        requestBody.useFallbacks = true;
    }
    if (useExternalLiquidity) {
        requestBody.useExternalLiquidity = true;
    }
    if (usePermit) {
        requestBody.usePermit = true;
    }


    const response = await fetch(`${RELAY_API_BASE}/quote/v2`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw await buildRelayError(response, `Quote failed: ${response.status}`);
    }

    const quote = await response.json();
    return quote;
}

export const getIndividualSwapQuote = getBridgeQuote;

export const getAggregatedSwapQuotes = async ({
    user,
    origins,
    destinationChainId,
    destinationCurrency,
    recipient,
    slippageTolerance = null,
    includedSwapSources = null,
    excludedSwapSources = null,
    explicitDeposit = true,
    useFallbacks = false,
    useExternalLiquidity = false,
    usePermit = false,
}) => {
    const finalRecipient = recipient || user;

    const quotePromises = origins.map(origin =>
        getIndividualSwapQuote({
            user,
            originChainId: origin.chainId,
            destinationChainId,
            originCurrency: origin.currency,
            destinationCurrency,
            amount: origin.amount,
            recipient: finalRecipient,
            slippageTolerance,
            includedSwapSources,
            excludedSwapSources,
            explicitDeposit,
            useFallbacks,
            useExternalLiquidity,
            usePermit,
        }).then(quote => ({ success: true, quote, origin }))
            .catch(error => ({ success: false, error, origin }))
    );

    const results = await Promise.all(quotePromises);

    const failures = results.filter(r => !r.success);
    const failedOrigins = [];
    const failedHighImpactOrigins = [];
    for (const failure of failures) {
        const errorCode = failure.error?.code || failure.error?.errorCode;
        if (errorCode === 'SWAP_IMPACT_TOO_HIGH') {
            failedHighImpactOrigins.push(failure.origin);
        } else {
            failedOrigins.push(failure.origin);
        }
    }


    const successfulQuotes = results.filter(r => r.success);
    if (successfulQuotes.length === 0) {
        throw new Error('All quote requests failed');
    }

    const validQuotes = [];
    const highImpactTokens = failedHighImpactOrigins.map(origin => origin.symbol || origin.currency.substring(0, 10));
    const excludedOrigins = [...failedHighImpactOrigins];

    for (const { quote, origin } of successfulQuotes) {
        const priceImpact = Math.abs(parseFloat(quote.details?.totalImpact?.percent || 0));
        if (priceImpact > MAX_PRICE_IMPACT) {
            highImpactTokens.push(origin.symbol || origin.currency.substring(0, 10));
            excludedOrigins.push(origin);
        } else {
            validQuotes.push({ quote, origin });
        }
    }

    if (validQuotes.length === 0) {
        throw new Error(`All tokens have high price impact (>${MAX_PRICE_IMPACT}%). Try smaller amounts or different tokens.`);
    }

    const aggregatedSteps = [];
    const requestIds = new Set();
    let totalInputUsd = 0;
    let totalOutputUsd = 0;

    for (const { quote } of validQuotes) {
        if (quote.steps) {
            aggregatedSteps.push(...quote.steps);
        }

        if (quote.steps) {
            for (const step of quote.steps) {
                if (step.requestId) requestIds.add(step.requestId);
                for (const item of step.items || []) {
                    if (item.check?.endpoint) {
                        const match = item.check.endpoint.match(/requestId=([^&]+)/);
                        if (match) requestIds.add(match[1]);
                    }
                }
            }
        }

        if (quote.details?.currencyIn?.amountUsd) {
            totalInputUsd += parseFloat(quote.details.currencyIn.amountUsd) || 0;
        }
        if (quote.details?.currencyOut?.amountUsd) {
            totalOutputUsd += parseFloat(quote.details.currencyOut.amountUsd) || 0;
        }
    }



    const validOrigins = validQuotes.map(({ origin }) => origin);

    return {
        steps: aggregatedSteps,
        details: {
            operation: 'aggregated_swap',
            currencyIn: {
                amountUsd: totalInputUsd.toFixed(2),
            },
            currencyOut: {
                currency: validQuotes[0]?.quote?.details?.currencyOut?.currency,
                amountFormatted: validQuotes.reduce((sum, { quote }) =>
                    sum + parseFloat(quote.details?.currencyOut?.amountFormatted || 0), 0
                ).toFixed(6),
                amountUsd: totalOutputUsd.toFixed(2),
            },
        },
        fees: {
            gas: validQuotes[0]?.quote?.fees?.gas,
            relayer: validQuotes[0]?.quote?.fees?.relayer,
        },
        requestIds: Array.from(requestIds),
        _aggregated: true,
        _quoteCount: validQuotes.length,
        _failedCount: failures.length,
        _excludedHighImpact: highImpactTokens,
        _validOrigins: validOrigins,
        _excludedOrigins: excludedOrigins,
        _failedOrigins: failedOrigins,
    };
};

export const getMultiInputQuote = async ({
    user,
    origins,
    destinationChainId,
    destinationCurrency,
    recipient,
    slippageTolerance = null,
    explicitDeposit = true,
    useFallbacks = false,
    useExternalLiquidity = false,
    partial = false,
}) => {
    const requestBody = {
        user,
        origins: origins.map(o => ({
            chainId: Number(o.chainId),
            currency: o.currency,
            amount: o.amount,
        })),
        destinationChainId: Number(destinationChainId),
        destinationCurrency,
        recipient: recipient || user,
        tradeType: 'EXACT_INPUT',
        referrer: 'relay.link',
        useDepositAddress: false,
        topupGas: false,
    };

    if (explicitDeposit !== null && explicitDeposit !== undefined) {
        requestBody.explicitDeposit = explicitDeposit;
    }
    if (slippageTolerance !== null) {
        requestBody.slippageTolerance = String(slippageTolerance);
    }
    if (useFallbacks) {
        requestBody.useFallbacks = true;
    }
    if (useExternalLiquidity) {
        requestBody.useExternalLiquidity = true;
    }
    if (partial) {
        requestBody.partial = true;
    }


    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`${RELAY_API_BASE}/execute/swap/multi-input`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw await buildRelayError(response, `Multi-input quote failed: ${response.status}`);
        }

        const quote = await response.json();
        return quote;
    } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
        }
        throw fetchError;
    }
};

export const SLIPPAGE_PRESETS = [
    { label: 'Auto', value: null },
    { label: '0.5%', value: 50 },
    { label: '1%', value: 100 },
    { label: '3%', value: 300 },
];

