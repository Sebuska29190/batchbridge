import { mainnet, base, arbitrum } from 'viem/chains';
import { createPublicClient, http } from 'viem';
import { getChainById } from '../wagmi';

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
const MAX_TRANSFER_FEE_CACHE_SIZE = 500;

const setTransferFeeCache = (key, value) => {
    transferFeeCache.set(key, value);
    if (transferFeeCache.size > MAX_TRANSFER_FEE_CACHE_SIZE) {
        const oldestKey = transferFeeCache.keys().next().value;
        transferFeeCache.delete(oldestKey);
    }
};
const PUBLIC_RPC_URLS = {
    1: ['https://rpc.ankr.com/eth', 'https://eth.llamarpc.com'],
    8453: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
    42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
};

// Duplicated from bridgeService.ts rather than imported: that file still
// needs its own copy for the functions staying there (checkTokenAllowance,
// fetchTokenMetadata, fetchTokenBalance), and this whole 3-chain-only client
// is legacy scope pending replacement once App.tsx is rewritten (Task 36) on
// top of the new 16-chain balances.ts. Not worth threading an import for a
// helper this small and this temporary.
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
        setTransferFeeCache(cacheKey, isFee);
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

    setTransferFeeCache(cacheKey, isFee);
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
            setTransferFeeCache(cacheKey, isFee);
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
            setTransferFeeCache(cacheKey, isFee);
            results.set(tokenAddress, isFee);
        }
    } catch {
        // On error, mark all uncached as non-fee tokens
        for (const tokenAddress of uncached) {
            const cacheKey = `${chainNumeric}-${tokenAddress}`;
            setTransferFeeCache(cacheKey, false);
            results.set(tokenAddress, false);
        }
    }

    return results;
};
