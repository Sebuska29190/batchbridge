import React, { useMemo, useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { Button } from '../common/Button'
import { ChainIcon } from '../common/ChainIcon'
import { TokenInput } from './TokenInput'
import { TokenSelectModal } from './TokenSelectModal'
import { QuoteComparison } from './QuoteComparison'
import { RouteDetails } from './RouteDetails'
import { SettingsPopover } from './SettingsPopover'
import { useQuote } from '../../hooks/useQuote'
import { useTokenBalances } from '../../hooks/useBalances'
import { useSwapExecution } from '../../hooks/useSwapExecution'
import { CHAINS, getChainConfig } from '../../config/chains'
import type { Token } from '../../services/tokenRegistry'
import type { Quote } from '../../services/aggregators/types'

const DEFAULT_FROM_CHAIN_ID = CHAINS[0].id
const DEFAULT_TO_CHAIN_ID = CHAINS[0].id

type ActiveSide = 'from' | 'to' | null

/** Parses a human-readable decimal amount into a wei string, or null if it isn't a positive number. */
function toWeiAmount(amount: string, decimals: number): string | null {
  if (!amount || amount === '.') return null
  try {
    const wei = parseUnits(amount, decimals)
    if (wei <= 0n) return null
    return wei.toString()
  } catch {
    return null
  }
}

/**
 * Swap mode: any liquid token to any liquid token, same chain or cross-chain
 * (e.g. USDC on Base to a memecoin on Polygon) - the aggregator layer already
 * handles the bridge-then-swap routing, this component just builds the
 * request and displays what comes back.
 */
export const SwapCard: React.FC = () => {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [fromChainId, setFromChainId] = useState(DEFAULT_FROM_CHAIN_ID)
  const [toChainId, setToChainId] = useState(DEFAULT_TO_CHAIN_ID)
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [amount, setAmount] = useState('')
  const [activeSide, setActiveSide] = useState<ActiveSide>(null)
  const [slippageBps, setSlippageBps] = useState<number | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const { data: balances } = useTokenBalances(
    fromChainId,
    address,
    fromToken ? [fromToken.address] : [],
  )
  const fromBalanceWei = fromToken ? balances?.[fromToken.address] : undefined
  const fromBalance =
    fromToken && fromBalanceWei !== undefined ? formatUnits(BigInt(fromBalanceWei), fromToken.decimals) : undefined

  const fromWeiAmount = fromToken ? toWeiAmount(amount, fromToken.decimals) : null

  const quoteRequest = useMemo(() => {
    if (!fromToken || !toToken || !fromWeiAmount || !address) return null
    return {
      fromChainId,
      toChainId,
      fromToken: fromToken.address,
      toToken: toToken.address,
      amount: fromWeiAmount,
      fromAddress: address,
      // Auto (null) maps to a conservative default; a fixed preset/custom
      // value is passed straight through in basis points.
      slippageBps: slippageBps ?? 50,
    }
  }, [fromChainId, toChainId, fromToken, toToken, fromWeiAmount, address, slippageBps])

  const { quotes, failures, bestQuote, isLoading: isQuoteLoading } = useQuote(quoteRequest)
  const { status: executionStatus, error: executionError, execute, reset: resetExecution } = useSwapExecution()

  const toAmountDisplay = bestQuote && toToken ? formatUnits(BigInt(bestQuote.toAmount), toToken.decimals) : ''

  const fromUsdValue =
    fromToken?.priceUsd !== undefined && amount ? fromToken.priceUsd * (parseFloat(amount) || 0) : undefined
  const toUsdValue =
    toToken?.priceUsd !== undefined && toAmountDisplay
      ? toToken.priceUsd * (parseFloat(toAmountDisplay) || 0)
      : undefined

  const handleFlip = () => {
    setFromChainId(toChainId)
    setToChainId(fromChainId)
    setFromToken(toToken)
    setToToken(fromToken)
    setAmount('')
    resetExecution()
  }

  const handleSelectToken = (token: Token) => {
    if (activeSide === 'from') setFromToken(token)
    else if (activeSide === 'to') setToToken(token)
    setActiveSide(null)
  }

  const handleSelectQuote = (_quote: Quote) => {
    // Quote selection for execution is wired to bestQuote below; a future
    // task can thread an explicit "selected quote" state through if users
    // should be able to execute a non-best offer instead of just viewing it.
  }

  const handleSwapClick = async () => {
    if (!bestQuote || !address) return
    await execute(bestQuote, address)
  }

  const canSwap =
    isConnected && Boolean(walletClient) && Boolean(bestQuote) && executionStatus !== 'approving' &&
    executionStatus !== 'executing' && executionStatus !== 'bridging'

  const swapButtonLabel = (() => {
    if (!isConnected) return 'Connect wallet'
    if (!fromToken || !toToken) return 'Select tokens'
    if (!amount || !fromWeiAmount) return 'Enter an amount'
    if (executionStatus === 'approving') return 'Approving…'
    if (executionStatus === 'executing') return 'Swapping…'
    if (executionStatus === 'bridging') return 'Bridging…'
    if (executionStatus === 'success') return 'Swapped'
    if (!bestQuote) return 'No route found'
    return `Swap ${fromToken.symbol} for ${toToken.symbol}`
  })()

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--ink-3)]">Swap</span>
          <button
            type="button"
            aria-label="Slippage settings"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="18" cy="18" r="2" />
            </svg>
          </button>
          <SettingsPopover
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            slippageBps={slippageBps}
            onSlippageChange={setSlippageBps}
          />
        </div>

        <div className="flex flex-col gap-1">
          <ChainRow chainId={fromChainId} onChangeChainId={setFromChainId} />
          <TokenInput
            label="You pay"
            amount={amount}
            onAmountChange={setAmount}
            token={fromToken}
            onTokenClick={() => setActiveSide('from')}
            balance={fromBalance}
            usdValue={fromUsdValue}
          />

          <div className="relative -my-1 flex justify-center">
            <button
              type="button"
              aria-label="Flip direction"
              onClick={handleFlip}
              className="z-10 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-2)] hover:text-[var(--accent)]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v16M12 20l-5-5M12 20l5-5" />
              </svg>
            </button>
          </div>

          <ChainRow chainId={toChainId} onChangeChainId={setToChainId} />
          <TokenInput
            label="You receive"
            amount={toAmountDisplay}
            token={toToken}
            onTokenClick={() => setActiveSide('to')}
            usdValue={toUsdValue}
            isLoadingAmount={isQuoteLoading && Boolean(quoteRequest)}
            readOnly
          />
        </div>

        <Button
          className="mt-3 w-full"
          variant="primary"
          size="lg"
          disabled={!canSwap}
          isLoading={executionStatus === 'approving' || executionStatus === 'executing' || executionStatus === 'bridging'}
          onClick={handleSwapClick}
        >
          {swapButtonLabel}
        </Button>

        {executionStatus === 'rejected' && (
          <p className="mt-2 text-center text-sm text-[var(--ink-3)]">Cancelled in wallet.</p>
        )}
        {executionStatus === 'error' && executionError && (
          <p className="mt-2 text-center text-sm text-[var(--neg)]">{executionError}</p>
        )}
      </div>

      {quoteRequest && (
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
          <div className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--ink-3)]">Offers</div>
          <QuoteComparison
            quotes={quotes}
            failures={failures}
            isLoading={isQuoteLoading}
            decimals={toToken?.decimals ?? 18}
            onSelectQuote={handleSelectQuote}
          />
          {bestQuote && toToken && fromToken && (
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <RouteDetails
                quote={bestQuote}
                fromDecimals={fromToken.decimals}
                toDecimals={toToken.decimals}
                fromSymbol={fromToken.symbol}
                toSymbol={toToken.symbol}
              />
            </div>
          )}
        </div>
      )}

      <TokenSelectModal
        isOpen={activeSide !== null}
        onClose={() => setActiveSide(null)}
        chainId={activeSide === 'to' ? toChainId : fromChainId}
        mode="swap"
        ownerAddress={address}
        onSelect={handleSelectToken}
      />
    </div>
  )
}

/** Compact inline chain picker shown above each TokenInput - reuses CHAINS/ChainIcon directly rather than the full bridge/ChainSelect dropdown, since swap mode doesn't need to exclude either side's chain from the other. */
const ChainRow: React.FC<{ chainId: number; onChangeChainId: (id: number) => void }> = ({
  chainId,
  onChangeChainId,
}) => {
  const chain = getChainConfig(chainId)
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-[var(--ink-3)]">
      <span>on</span>
      <select
        aria-label="Chain"
        value={chainId}
        onChange={(event) => onChangeChainId(Number(event.target.value))}
        className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-[var(--ink)] outline-none"
      >
        {CHAINS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {chain && <ChainIcon logo={chain.logo} name={chain.name} size={16} />}
    </div>
  )
}
