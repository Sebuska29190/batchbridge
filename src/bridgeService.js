import { mainnet, base, arbitrum } from 'viem/chains';
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { getChainById } from './wagmi';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const RELAY_API_BASE = 'https://api.relay.link';
const TRANSFER_FEE_FUNCTIONS = [
    'transferFee',
    'transferFeeBps',
    'transferFeeBP',
    'transferFeeBasisPoints',
];
const TRANSFER_FEE_ABI = TRANSFER_FEE_FUNCTIONS.map(name => ({
    name,
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
}));
const KNOWN_TRANSFER_FEE_TOKENS = {
    8453: {
        '0xfb42da273158b0f642f59f2ba7cc1d5457481677': 125,
    },
};
const transferFeeCache = new Map();
const PUBLIC_RPC_URLS = {
    1: ['https://rpc.ankr.com/eth', 'https://eth.llamarpc.com'],
    8453: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
    42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
};
const ALCHEMY_RPC_URLS = {
    1: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    8453: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
};


export const RELAY_ERROR_CODES = {
    AMOUNT_TOO_LOW: 'AMOUNT_TOO_LOW',
    CHAIN_DISABLED: 'CHAIN_DISABLED',
    EXTRA_TXS_NOT_SUPPORTED: 'EXTRA_TXS_NOT_SUPPORTED',
    FORBIDDEN: 'FORBIDDEN',
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    INSUFFICIENT_LIQUIDITY: 'INSUFFICIENT_LIQUIDITY',
    INVALID_ADDRESS: 'INVALID_ADDRESS',
    INVALID_EXTRA_TXS: 'INVALID_EXTRA_TXS',
    INVALID_GAS_LIMIT_FOR_DEPOSIT_SPECIFIED_TXS: 'INVALID_GAS_LIMIT_FOR_DEPOSIT_SPECIFIED_TXS',
    INVALID_INPUT_CURRENCY: 'INVALID_INPUT_CURRENCY',
    INVALID_OUTPUT_CURRENCY: 'INVALID_OUTPUT_CURRENCY',
    INVALID_SLIPPAGE_TOLERANCE: 'INVALID_SLIPPAGE_TOLERANCE',
    NO_SWAP_ROUTES_FOUND: 'NO_SWAP_ROUTES_FOUND',
    NO_INTERNAL_SWAP_ROUTES_FOUND: 'NO_INTERNAL_SWAP_ROUTES_FOUND',
    NO_QUOTES: 'NO_QUOTES',
    ROUTE_TEMPORARILY_RESTRICTED: 'ROUTE_TEMPORARILY_RESTRICTED',
    SANCTIONED_CURRENCY: 'SANCTIONED_CURRENCY',
    SANCTIONED_WALLET_ADDRESS: 'SANCTIONED_WALLET_ADDRESS',
    SWAP_IMPACT_TOO_HIGH: 'SWAP_IMPACT_TOO_HIGH',
    UNAUTHORIZED: 'UNAUTHORIZED',
    UNSUPPORTED_CHAIN: 'UNSUPPORTED_CHAIN',
    UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
    UNSUPPORTED_EXECUTION_TYPE: 'UNSUPPORTED_EXECUTION_TYPE',
    UNSUPPORTED_ROUTE: 'UNSUPPORTED_ROUTE',
    USER_RECIPIENT_MISMATCH: 'USER_RECIPIENT_MISMATCH',
    DESTINATION_TX_FAILED: 'DESTINATION_TX_FAILED',
    ERC20_ROUTER_ADDRESS_NOT_FOUND: 'ERC20_ROUTER_ADDRESS_NOT_FOUND',
    SWAP_QUOTE_FAILED: 'SWAP_QUOTE_FAILED',
    PERMIT_FAILED: 'PERMIT_FAILED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

export const getRelayErrorMessage = (errorCode, fallbackMessage) => {
    const messages = {
        [RELAY_ERROR_CODES.AMOUNT_TOO_LOW]: 'Amount is too low for this swap. Try a larger amount.',
        [RELAY_ERROR_CODES.CHAIN_DISABLED]: 'This chain is temporarily disabled.',
        [RELAY_ERROR_CODES.EXTRA_TXS_NOT_SUPPORTED]: 'Extra transactions are not supported for this route.',
        [RELAY_ERROR_CODES.FORBIDDEN]: 'This request is not permitted.',
        [RELAY_ERROR_CODES.INSUFFICIENT_FUNDS]: 'Insufficient balance to complete this swap.',
        [RELAY_ERROR_CODES.INSUFFICIENT_LIQUIDITY]: 'Not enough liquidity available. Try a smaller amount or different token.',
        [RELAY_ERROR_CODES.INVALID_ADDRESS]: 'Invalid wallet address.',
        [RELAY_ERROR_CODES.INVALID_EXTRA_TXS]: 'Extra transactions exceed the intended output.',
        [RELAY_ERROR_CODES.INVALID_GAS_LIMIT_FOR_DEPOSIT_SPECIFIED_TXS]: 'Invalid gas limit for deposit-specified transactions.',
        [RELAY_ERROR_CODES.INVALID_INPUT_CURRENCY]: 'Unsupported input token for this route.',
        [RELAY_ERROR_CODES.INVALID_OUTPUT_CURRENCY]: 'Unsupported output token for this route.',
        [RELAY_ERROR_CODES.NO_SWAP_ROUTES_FOUND]: 'No route found for this swap. The token pair may not be supported.',
        [RELAY_ERROR_CODES.NO_INTERNAL_SWAP_ROUTES_FOUND]: 'No internal swap route available for this token.',
        [RELAY_ERROR_CODES.NO_QUOTES]: 'Unable to get a quote. Try again or use a different token.',
        [RELAY_ERROR_CODES.ROUTE_TEMPORARILY_RESTRICTED]: 'This route is temporarily unavailable. Please try again later.',
        [RELAY_ERROR_CODES.SANCTIONED_CURRENCY]: 'This token is restricted and cannot be swapped.',
        [RELAY_ERROR_CODES.SANCTIONED_WALLET_ADDRESS]: 'This wallet address is restricted.',
        [RELAY_ERROR_CODES.SWAP_IMPACT_TOO_HIGH]: 'Price impact is too high. Try a smaller amount.',
        [RELAY_ERROR_CODES.UNSUPPORTED_CURRENCY]: 'This token is not supported for swapping.',
        [RELAY_ERROR_CODES.UNSUPPORTED_CHAIN]: 'This chain is not currently supported.',
        [RELAY_ERROR_CODES.UNSUPPORTED_EXECUTION_TYPE]: 'This execution type is not supported.',
        [RELAY_ERROR_CODES.UNSUPPORTED_ROUTE]: 'This swap route is not supported.',
        [RELAY_ERROR_CODES.UNAUTHORIZED]: 'Unauthorized request.',
        [RELAY_ERROR_CODES.USER_RECIPIENT_MISMATCH]: 'Recipient must match the connected wallet for this route.',
        [RELAY_ERROR_CODES.DESTINATION_TX_FAILED]: 'The transaction failed on the destination chain.',
        [RELAY_ERROR_CODES.ERC20_ROUTER_ADDRESS_NOT_FOUND]: 'Routing contract not found for this token.',
        [RELAY_ERROR_CODES.SWAP_QUOTE_FAILED]: 'Failed to calculate quote. Please try again.',
        [RELAY_ERROR_CODES.PERMIT_FAILED]: 'Permit signature failed. Please try again.',
        [RELAY_ERROR_CODES.INVALID_SLIPPAGE_TOLERANCE]: 'Invalid slippage value.',
    };
    return messages[errorCode] || fallbackMessage || 'An error occurred. Please try again.';
};

const getPublicClient = (chainId) => {
    const chainNumeric = Number(chainId);
    const chainInfo = getChainById(chainNumeric);
    if (!chainInfo) throw new Error(`Unsupported chain ID: ${chainId}`);

    const rpcUrls = PUBLIC_RPC_URLS[chainNumeric];
    const alchemyUrl = ALCHEMY_RPC_URLS[chainNumeric];
    const rpcUrl = ALCHEMY_API_KEY && alchemyUrl
        ? alchemyUrl
        : rpcUrls?.[0];
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

export const detectTransferFeeToken = async (chainId, tokenAddress) => {
    if (!tokenAddress) return false;
    const normalizedAddress = tokenAddress.toLowerCase();
    if (normalizedAddress === '0x0000000000000000000000000000000000000000') return false;
    const chainNumeric = Number(chainId);
    if (!Number.isFinite(chainNumeric)) return false;

    const cacheKey = `${chainNumeric}-${normalizedAddress}`;
    if (transferFeeCache.has(cacheKey)) {
        return transferFeeCache.get(cacheKey);
    }

    const knownFee = KNOWN_TRANSFER_FEE_TOKENS[chainNumeric]?.[normalizedAddress];
    if (knownFee !== undefined) {
        const isFee = Number(knownFee) > 0;
        transferFeeCache.set(cacheKey, isFee);
        return isFee;
    }

    const publicClient = getPublicClient(chainNumeric);

    const contracts = TRANSFER_FEE_FUNCTIONS.map(functionName => ({
        address: tokenAddress,
        abi: TRANSFER_FEE_ABI,
        functionName,
    }));

    let isFee = false;
    try {
        const results = await publicClient.multicall({
            contracts,
            allowFailure: true,
        });

        for (const result of results) {
            if (result.status === 'success' && result.result !== undefined && result.result !== null) {
                const feeValue = BigInt(result.result);
                if (feeValue > 0n) {
                    isFee = true;
                    break;
                }
            }
        }
    } catch { }

    transferFeeCache.set(cacheKey, isFee);
    return isFee;
};

export const detectTransferFeeTokensBatch = async (chainId, tokenAddresses) => {
    if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) return new Map();
    const chainNumeric = Number(chainId);
    if (!Number.isFinite(chainNumeric)) return new Map();

    const results = new Map();
    const uncached = [];

    for (const tokenAddress of tokenAddresses) {
        if (!tokenAddress) continue;
        const normalizedAddress = tokenAddress.toLowerCase();
        if (normalizedAddress === '0x0000000000000000000000000000000000000000') {
            results.set(normalizedAddress, false);
            continue;
        }

        const cacheKey = `${chainNumeric}-${normalizedAddress}`;
        if (transferFeeCache.has(cacheKey)) {
            results.set(normalizedAddress, transferFeeCache.get(cacheKey));
            continue;
        }

        const knownFee = KNOWN_TRANSFER_FEE_TOKENS[chainNumeric]?.[normalizedAddress];
        if (knownFee !== undefined) {
            const isFee = Number(knownFee) > 0;
            transferFeeCache.set(cacheKey, isFee);
            results.set(normalizedAddress, isFee);
            continue;
        }

        uncached.push(normalizedAddress);
    }

    if (uncached.length === 0) return results;

    const publicClient = getPublicClient(chainNumeric);

    // Build all contracts for all tokens and all function names
    const contracts = [];
    for (const tokenAddress of uncached) {
        for (const functionName of TRANSFER_FEE_FUNCTIONS) {
            contracts.push({
                address: tokenAddress,
                abi: TRANSFER_FEE_ABI,
                functionName,
                _tokenAddress: tokenAddress,
            });
        }
    }

    try {
        const multicallResults = await publicClient.multicall({
            contracts: contracts.map(({ _tokenAddress, ...c }) => c),
            allowFailure: true,
        });

        // Process results - each token has TRANSFER_FEE_FUNCTIONS.length results
        const functionsCount = TRANSFER_FEE_FUNCTIONS.length;
        for (let i = 0; i < uncached.length; i++) {
            const tokenAddress = uncached[i];
            const startIdx = i * functionsCount;
            let isFee = false;

            for (let j = 0; j < functionsCount; j++) {
                const result = multicallResults[startIdx + j];
                if (result.status === 'success' && result.result !== undefined && result.result !== null) {
                    const feeValue = BigInt(result.result);
                    if (feeValue > 0n) {
                        isFee = true;
                        break;
                    }
                }
            }

            const cacheKey = `${chainNumeric}-${tokenAddress}`;
            transferFeeCache.set(cacheKey, isFee);
            results.set(tokenAddress, isFee);
        }
    } catch {
        // On error, mark all uncached as non-fee tokens
        for (const tokenAddress of uncached) {
            const cacheKey = `${chainNumeric}-${tokenAddress}`;
            transferFeeCache.set(cacheKey, false);
            results.set(tokenAddress, false);
        }
    }

    return results;
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

export const checkTokenAllowance = async (chainId, tokenAddress, ownerAddress, spenderAddress) => {
    try {
        const spender = spenderAddress;
        if (!spender) {
            return BigInt(0);
        }

        const client = getPublicClient(chainId);
        const allowance = await client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [ownerAddress, spender],
        });

        return allowance;
    } catch (error) {
        return BigInt(0);
    }
};

const getTokenLogoUrl = (chainId, tokenAddress) => {
    if (!tokenAddress) return null;

    return `https://api.sim.dune.com/beta/token/logo/${chainId}/${tokenAddress.toLowerCase()}`;
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



export const fetchTokenHoldings = async (address, chainId) => {
    const chainInfo = getChainById(chainId);
    if (!chainInfo) {
        throw new Error(`Unsupported chain: ${chainId}`);
    }

    let allItems = [];
    let nextToken = null;
    const LIMIT = 100;
    const MAX_PAGES = 10;

    for (let page = 0; page < MAX_PAGES; page++) {
        let url = `/api/routescan?chainId=${chainId}&address=${address}&limit=${LIMIT}`;
        if (nextToken) {
            url += `&next=${encodeURIComponent(nextToken)}`;
        }

        const response = await fetch(url, {
            headers: {
                'accept': 'application/json',
            },
        });

        if (!response.ok) {
            if (page === 0) throw new Error(`Failed to fetch holdings: ${response.status}`);
            break;
        }

        const data = await response.json();
        allItems = allItems.concat(data.items || []);

        if (data.link?.nextToken) {
            nextToken = data.link.nextToken;
        } else {
            break;
        }
    }

    const filteredItems = allItems.filter(item => {
        if (!item.tokenSymbol || !item.tokenAddress) return false;
        if (item.tokenQuantity === '0') return false;
        if (/[^\w\s.-]/.test(item.tokenSymbol)) return false;
        const usdValue = parseFloat(item.tokenValueInUsd || '0');
        if (usdValue <= 0) return false;
        return true;
    });

    if (filteredItems.length === 0) {
        return [];
    }

    const publicClient = getPublicClient(chainId);

    const balanceCalls = filteredItems.map(item => ({
        address: item.tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
    }));

    let onChainBalances = [];
    try {
        onChainBalances = await publicClient.multicall({
            contracts: balanceCalls,
            allowFailure: true,
        });
    } catch (error) {
        onChainBalances = filteredItems.map(() => ({ status: 'failure' }));
    }

    const verifiedHoldings = filteredItems
        .map((item, index) => {
            const onChainResult = onChainBalances[index];
            let balance = item.tokenQuantity;
            const decimals = Number.isFinite(Number(item.tokenDecimals)) ? Number(item.tokenDecimals) : 18;

            if (onChainResult?.status === 'success' && onChainResult.result !== undefined) {
                balance = onChainResult.result.toString();
                if (balance === '0') return null;
            }

            return {
                address: item.tokenAddress,
                symbol: item.tokenSymbol,
                name: item.tokenName || item.tokenSymbol,
                decimals,
                balance: balance,
                balanceFormatted: formatBalance(balance, decimals),
                price: item.tokenPrice ? parseFloat(item.tokenPrice) : 0,
                valueUsd: item.tokenValueInUsd ? parseFloat(item.tokenValueInUsd) : 0,
                chainId: Number(chainId),
                logo: getTokenLogoUrl(chainId, item.tokenAddress),
                verified: true,
                routeAvailable: null,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.valueUsd - a.valueUsd);

    const repricedHoldings = await applyRelayPrices(verifiedHoldings, chainId);
    return repricedHoldings;
};

const routeCache = new Map();
const ROUTE_CACHE_TTL = 5 * 60 * 1000;
const relayPriceCache = new Map();
const RELAY_PRICE_CACHE_TTL = 5 * 60 * 1000;

export const MAX_PRICE_IMPACT = 15;

const mapWithConcurrency = async (items, limit, mapper) => {
    const results = new Array(items.length);
    let index = 0;

    const runWorker = async () => {
        while (index < items.length) {
            const current = index++;
            results[current] = await mapper(items[current], current);
        }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, runWorker);
    await Promise.all(workers);
    return results;
};

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

const applyRelayPrices = async (holdings, chainId) => {
    const updated = await mapWithConcurrency(
        holdings,
        10,
        token => applyRelayPriceToToken(token, chainId)
    );

    return updated.sort((a, b) => b.valueUsd - a.valueUsd);
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
    // Limit transferFeeCache size to prevent memory growth
    const MAX_TRANSFER_FEE_CACHE_SIZE = 500;
    if (transferFeeCache.size > MAX_TRANSFER_FEE_CACHE_SIZE) {
        const keysToDelete = Array.from(transferFeeCache.keys()).slice(0, transferFeeCache.size - MAX_TRANSFER_FEE_CACHE_SIZE);
        for (const key of keysToDelete) {
            transferFeeCache.delete(key);
        }
    }
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

const APPROVE_SELECTOR = '0x095ea7b3';

const parseApproveData = (calldata) => {
    if (!calldata) return null;
    const normalized = calldata.toLowerCase();
    if (!normalized.startsWith(APPROVE_SELECTOR)) return null;
    const payload = normalized.slice(10);
    if (payload.length < 128) return null;
    const spenderChunk = payload.slice(0, 64);
    const amountChunk = payload.slice(64, 128);
    const spender = `0x${spenderChunk.slice(24)}`;
    const amount = BigInt(`0x${amountChunk}`);
    return { spender, amount };
};

const isApprovalStepId = (stepId) => stepId === 'approve' || stepId === 'approval';

export const filterApproveStepsByAllowance = async (quote, ownerAddress) => {
    if (!quote?.steps || !ownerAddress) {
        return quote;
    }

    const approvalTargets = new Map();

    for (const step of quote.steps) {
        if (!isApprovalStepId(step.id)) continue;
        for (const item of step.items || []) {
            const tokenAddress = item.data?.to;
            const parsed = parseApproveData(item.data?.data);
            if (!tokenAddress || !parsed) continue;
            const chainId = Number(item.data?.chainId);
            const key = `${chainId}-${tokenAddress.toLowerCase()}-${parsed.spender.toLowerCase()}`;
            const existing = approvalTargets.get(key);
            if (!existing || parsed.amount > existing.requiredAmount) {
                approvalTargets.set(key, {
                    chainId,
                    tokenAddress,
                    spender: parsed.spender,
                    requiredAmount: parsed.amount,
                });
            }
        }
    }

    if (approvalTargets.size === 0) {
        return quote;
    }

    const allowanceEntries = await Promise.all(
        Array.from(approvalTargets.entries()).map(async ([key, entry]) => {
            const allowance = await checkTokenAllowance(
                entry.chainId,
                entry.tokenAddress,
                ownerAddress,
                entry.spender
            );
            return [key, allowance];
        })
    );

    const allowanceMap = new Map(allowanceEntries);

    const filteredSteps = quote.steps
        .map(step => {
            if (!isApprovalStepId(step.id)) return step;

            const items = (step.items || []).filter(item => {
                const tokenAddress = item.data?.to;
                const parsed = parseApproveData(item.data?.data);
                if (!tokenAddress || !parsed) return true;
                const chainId = Number(item.data?.chainId);
                const key = `${chainId}-${tokenAddress.toLowerCase()}-${parsed.spender.toLowerCase()}`;
                const allowance = allowanceMap.get(key);
                const required = approvalTargets.get(key)?.requiredAmount;
                if (allowance !== undefined && required !== undefined && allowance >= required) {
                    return false;
                }
                return true;
            });

            return { ...step, items };
        })
        .filter(step => !isApprovalStepId(step.id) || (step.items && step.items.length > 0));

    return { ...quote, steps: filteredSteps };
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

export const submitRelaySignature = async ({ signature, post }) => {
    if (!signature) {
        throw new Error('Missing signature for permit submission');
    }
    if (!post?.endpoint) {
        throw new Error('Missing permit submission endpoint');
    }

    const endpoint = normalizeRelayEndpoint(post.endpoint);
    const method = (post.method || 'POST').toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const url = new URL(endpoint);
    url.searchParams.set('signature', signature);

    const response = await fetch(url.toString(), {
        method,
        headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
        body: hasBody && post.body ? JSON.stringify(post.body) : undefined,
    });

    if (!response.ok) {
        throw await buildRelayError(response, `Permit submission failed: ${response.status}`);
    }

    return await response.json().catch(() => ({}));
};

const normalizeStatusEndpoint = (endpointOrRequestId) => {
    if (!endpointOrRequestId) return null;
    if (endpointOrRequestId.startsWith('http')) return endpointOrRequestId;
    if (endpointOrRequestId.startsWith('/')) {
        return `${RELAY_API_BASE}${endpointOrRequestId}`;
    }
    return `${RELAY_API_BASE}/intents/status/v3?requestId=${endpointOrRequestId}`;
};

export const pollBridgeStatus = async (endpointOrRequestId, maxAttempts = 60, intervalMs = 2000) => {
    const statusUrl = normalizeStatusEndpoint(endpointOrRequestId);
    if (!statusUrl) {
        return { success: false, error: 'Missing status endpoint' };
    }

    let lastStatus = null;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(statusUrl);

            if (!response.ok) {
                await new Promise(r => setTimeout(r, intervalMs));
                continue;
            }

            const status = await response.json();
            lastStatus = status;

            const statusValue = (status.status || '').toLowerCase();
            if (statusValue === 'success' || statusValue === 'confirmed') {
                return { success: true, status };
            }

            if (['failure', 'failed', 'reverted', 'refund', 'refunded', 'fallback'].includes(statusValue)) {
                return { success: false, status, error: 'Bridge transaction failed' };
            }

            await new Promise(r => setTimeout(r, intervalMs));
        } catch (error) {
            await new Promise(r => setTimeout(r, intervalMs));
        }
    }

    if (lastStatus) {
        const statusValue = (lastStatus.status || 'unknown').toLowerCase();
        return {
            success: false,
            status: lastStatus,
            error: `Bridge still ${statusValue} after waiting`,
        };
    }

    return { success: false, error: 'Timeout waiting for bridge confirmation' };
};

export const SLIPPAGE_PRESETS = [
    { label: 'Auto', value: null },
    { label: '0.5%', value: 50 },
    { label: '1%', value: 100 },
    { label: '3%', value: 300 },
];

export const isUserRejection = (error) => {
    if (!error) return false;
    const message = (error.message || error.shortMessage || '').toLowerCase();
    const revertHint = message.includes('revert') || message.includes('reverted') ||
        message.includes('execution reverted') || message.includes('simulation');
    if ((error.code === 4001 || error.code === 'ACTION_REJECTED') && !revertHint) {
        return true;
    }
    return message.includes('rejected') || message.includes('denied') ||
        message.includes('cancelled') || message.includes('canceled') ||
        message.includes('user refused') || message.includes('user declined') ||
        message.includes('user closed') || message.includes('user rejected');
};
