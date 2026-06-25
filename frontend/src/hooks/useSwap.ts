import { useState, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import {
  SWAP_TOKEN_LIST,
  getBestQuote,
  getAllQuotes,
  getSwapTransaction,
  getTokenPrice,
  SWAP_SLIPPAGE_PRESETS,
} from '../swapService';
import type { SwapQuote } from '../swapService';
import { erc20Abi, parseUnits } from 'viem';

export function useSwap() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [srcToken, setSrcToken] = useState<(typeof SWAP_TOKEN_LIST)[number] | null>(null);
  const [dstToken, setDstToken] = useState<(typeof SWAP_TOKEN_LIST)[number] | null>(null);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(1.0);
  const [customSlippage, setCustomSlippage] = useState('');

  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [allQuotes, setAllQuotes] = useState<SwapQuote[]>([]);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const swapTokens = useCallback(() => {
    setSrcToken(dstToken);
    setDstToken(srcToken);
    setQuote(null);
    setError('');
  }, [srcToken, dstToken]);

  const handleGetQuote = useCallback(async () => {
    if (!srcToken || !dstToken || !amount) {
      setError('Select tokens and enter amount');
      return;
    }
    if (srcToken.address === dstToken.address) {
      setError('Cannot swap same token');
      return;
    }

    setIsLoadingQuote(true);
    setError('');
    setQuote(null);

    try {
      const best = await getBestQuote(
        srcToken.address,
        dstToken.address,
        amount,
        srcToken.decimals,
      );

      // Also fetch all quotes for comparison
      const all = await getAllQuotes(
        srcToken.address,
        dstToken.address,
        amount,
        srcToken.decimals,
      );
      setAllQuotes(all);

      if (!best) {
        setError('No route found for this pair. Try a different amount or pair.');
      } else {
        setQuote(best);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to get quote');
    } finally {
      setIsLoadingQuote(false);
    }
  }, [srcToken, dstToken, amount]);

  const handleSwap = useCallback(async () => {
    if (!srcToken || !dstToken || !amount || !address) {
      setError('Connect wallet and fill all fields');
      return;
    }

    setIsSwapping(true);
    setError('');
    setStatus('Getting swap data...');
    setTxHash(null);

    try {
      const swapQuote = await getSwapTransaction(
        srcToken.address,
        dstToken.address,
        amount,
        srcToken.decimals,
        address,
        slippage,
      );

      if (!swapQuote?.txData) {
        throw new Error('Failed to get swap transaction data');
      }

      // If approval needed, do it first
      if (swapQuote.approvalNeeded && srcToken.address !== '0x0000000000000000000000000000000000000000') {
        setStatus('Approving token...');
        const approveTx = await writeContractAsync({
          address: srcToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [swapQuote.approvalNeeded.spender as `0x${string}`, BigInt(swapQuote.approvalNeeded.amount)],
          chainId: base.id,
        });
        showToast(`Approval TX: ${approveTx.slice(0, 10)}...`);
      }

      // Execute swap
      setStatus('Confirm swap in wallet...');
      const hash = await writeContractAsync({
        address: swapQuote.txData.to as `0x${string}`,
        abi: [], // raw calldata execution
        functionName: 'swap', // placeholder — handled by calldata
        chainId: base.id,
        // @ts-expect-error — 1inch swap uses raw transaction calldata
        data: swapQuote.txData.data,
        value: BigInt(swapQuote.txData.value || '0'),
      }).catch(async (err) => {
        // Fallback: send raw transaction via wallet
        if (window.ethereum) {
          const tx = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: address,
              to: swapQuote.txData!.to,
              data: swapQuote.txData!.data,
              value: swapQuote.txData!.value || '0x0',
            }],
          });
          return tx as `0x${string}`;
        }
        throw err;
      });

      setTxHash(hash);
      setStatus('Swap complete!');
      showToast(`Swapped ${amount} ${srcToken.symbol} → ~${swapQuote.dstAmountFormatted} ${dstToken.symbol}`);

    } catch (err: any) {
      if (err?.message?.includes('User rejected') || err?.code === 4001) {
        setError('Transaction cancelled');
      } else {
        setError(err?.shortMessage || err?.message || 'Swap failed');
      }
    } finally {
      setIsSwapping(false);
    }
  }, [srcToken, dstToken, amount, address, slippage, writeContractAsync, showToast]);

  return {
    // State
    srcToken, dstToken, amount, slippage, customSlippage,
    quote, isLoadingQuote, isSwapping, error, txHash, status, toast,
    // Actions
    setSrcToken, setDstToken, setAmount, setSlippage, setCustomSlippage,
    swapTokens, handleGetQuote, handleSwap,
    // Constants
    SWAP_TOKEN_LIST, SWAP_SLIPPAGE_PRESETS,
    isConnected,
  };
}
