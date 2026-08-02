import React, { useMemo, useState } from 'react'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { Button } from '../common/Button'
import { ChainSelect } from './ChainSelect'
import { TokenInput } from '../swap/TokenInput'
import { TransferProgress } from './TransferProgress'
import type { TransferStep } from './TransferProgress'
import { useQuote } from '../../hooks/useQuote'
import { useTokenBalances } from '../../hooks/useBalances'
import { useSwapExecution } from '../../hooks/useSwapExecution'
import type { ExecutionStatus } from '../../hooks/useSwapExecution'
import { CHAINS, getChainConfig } from '../../config/chains'
import { getBridgeableTokens, getEquivalent } from '../../config/bridgeableAssets'
import type { Token } from '../../services/tokenRegistry'

const DEFAULT_FROM_CHAIN_ID = CHAINS[0].id
const DEFAULT_TO_CHAIN_ID = CHAINS[1].id

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

const STEP_LABELS = ['Approve', 'Bridge', 'Confirm'] as const

/**
 * `useSwapExecution` only exposes one coarse `ExecutionStatus`, never which
 * index of the underlying quote's step list is currently running, so this
 * maps that single value onto a fixed 3-step Approve/Bridge/Confirm list
 * with a judgment-call heuristic:
 * - 'approving' -> step 0 (Approve) active, rest pending.
 * - 'executing' and 'bridging' both collapse onto step 1 (Bridge) active:
 *   from Bridge mode's perspective both mean "the on-chain transfer
 *   transaction is currently in flight" - `executing` is really a holdover
 *   status name for generic non-approve/non-bridge QuoteSteps, which are
 *   uncommon for a pure cross-chain bridge quote, so treating it the same
 *   as `bridging` here is the more useful signal for this UI.
 * - 'success' marks all three steps done.
 * - 'error' and 'rejected' both attribute the failure to step 1 (Bridge),
 *   leaving Approve marked success: this is a best-effort placement (the
 *   hook exposes no per-step failure info), chosen because approval
 *   failures are rare relative to the bridge leg itself failing or being
 *   cancelled after approval already went through.
 */
function buildTransferSteps(status: ExecutionStatus): TransferStep[] {
  if (status === 'approving') {
    return [
      { label: STEP_LABELS[0], status: 'active' },
      { label: STEP_LABELS[1], status: 'pending' },
      { label: STEP_LABELS[2], status: 'pending' },
    ]
  }
  if (status === 'executing' || status === 'bridging') {
    return [
      { label: STEP_LABELS[0], status: 'success' },
      { label: STEP_LABELS[1], status: 'active' },
      { label: STEP_LABELS[2], status: 'pending' },
    ]
  }
  if (status === 'success') {
    return STEP_LABELS.map(label => ({ label, status: 'success' as const }))
  }
  if (status === 'error' || status === 'rejected') {
    return [
      { label: STEP_LABELS[0], status: 'success' },
      { label: STEP_LABELS[1], status: 'error' },
      { label: STEP_LABELS[2], status: 'pending' },
    ]
  }
  // 'idle' - not expected to be rendered (guarded at the call site), but
  // return a sensible all-pending list rather than nothing.
  return STEP_LABELS.map(label => ({ label, status: 'pending' as const }))
}

/**
 * Bridge mode: the same asset moved between chains (e.g. ETH on Base to ETH
 * on Ethereum). Unlike Swap mode, the destination token is never a free
 * pick - it's forced to the source asset's equivalent on the destination
 * chain via `getEquivalent`, and the asset choice itself is a narrow set of
 * bridgeable symbols rather than a full token-search modal.
 */
export const BridgeCard: React.FC = () => {
  const { address, isConnected, chainId: connectedChainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()

  const [fromChainId, setFromChainId] = useState(DEFAULT_FROM_CHAIN_ID)
  const [toChainId, setToChainId] = useState(DEFAULT_TO_CHAIN_ID)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [amount, setAmount] = useState('')

  const handleChangeFromChainId = (id: number) => {
    setFromChainId(id)
    setSelectedSymbol(prev => (prev && getEquivalent(prev, id, toChainId) ? prev : null))
  }

  const handleChangeToChainId = (id: number) => {
    setToChainId(id)
    setSelectedSymbol(prev => (prev && getEquivalent(prev, fromChainId, id) ? prev : null))
  }

  // Only symbols that exist on the source chain AND resolve to a real
  // equivalent address on the destination chain are selectable.
  const availableSymbols = useMemo(
    () =>
      getBridgeableTokens(fromChainId)
        .map(entry => entry.symbol)
        .filter(symbol => getEquivalent(symbol, fromChainId, toChainId) !== null),
    [fromChainId, toChainId],
  )

  const fromTokenEntry = selectedSymbol
    ? getBridgeableTokens(fromChainId).find(entry => entry.symbol === selectedSymbol)
    : undefined
  const fromToken: Token | null = fromTokenEntry
    ? {
        chainId: fromChainId,
        address: fromTokenEntry.address,
        symbol: fromTokenEntry.symbol,
        name: fromTokenEntry.symbol,
        decimals: fromTokenEntry.decimals,
      }
    : null

  const toTokenEntry = selectedSymbol
    ? getBridgeableTokens(toChainId).find(entry => entry.symbol === selectedSymbol)
    : undefined
  const toToken: Token | null = toTokenEntry
    ? {
        chainId: toChainId,
        address: toTokenEntry.address,
        symbol: toTokenEntry.symbol,
        name: toTokenEntry.symbol,
        decimals: toTokenEntry.decimals,
      }
    : null

  const { data: balances } = useTokenBalances(fromChainId, address, fromToken ? [fromToken.address] : [])
  const fromBalanceWei = fromToken ? balances?.[fromToken.address] : undefined
  const fromBalance =
    fromToken && fromBalanceWei !== undefined ? formatUnits(BigInt(fromBalanceWei), fromToken.decimals) : undefined

  const fromWeiAmount = fromToken ? toWeiAmount(amount, fromToken.decimals) : null

  const quoteRequest = useMemo(() => {
    if (!fromToken || !selectedSymbol || !fromWeiAmount || !address) return null
    const toAddress = getEquivalent(selectedSymbol, fromChainId, toChainId)
    if (!toAddress) return null
    return {
      fromChainId,
      toChainId,
      fromToken: fromToken.address,
      toToken: toAddress,
      amount: fromWeiAmount,
      fromAddress: address,
      slippageBps: 50,
    }
  }, [fromToken, selectedSymbol, fromWeiAmount, address, fromChainId, toChainId])

  const { bestQuote, noRouteReason, isLoading: isQuoteLoading } = useQuote(quoteRequest)
  const { status: executionStatus, error: executionError, execute } = useSwapExecution()

  const toAmountDisplay = bestQuote && toToken ? formatUnits(BigInt(bestQuote.toAmount), toToken.decimals) : ''

  const handleBridgeClick = async () => {
    if (!bestQuote || !address) return
    await execute(bestQuote, address)
  }

  // Wrong-chain check only applies once a wallet is actually connected -
  // `connectedChainId` is undefined while disconnected, which must not be
  // mistaken for "on the wrong chain".
  const isWrongChain = isConnected && connectedChainId !== undefined && connectedChainId !== fromChainId

  const insufficientBalance =
    fromBalanceWei !== undefined && fromWeiAmount !== null && BigInt(fromWeiAmount) > BigInt(fromBalanceWei)

  const handleSwitchChain = () => switchChain?.({ chainId: fromChainId })

  const canBridge =
    isConnected &&
    !isWrongChain &&
    !insufficientBalance &&
    Boolean(walletClient) &&
    Boolean(bestQuote) &&
    executionStatus !== 'approving' &&
    executionStatus !== 'executing' &&
    executionStatus !== 'bridging'

  const bridgeButtonLabel = (() => {
    if (!isConnected) return 'Connect wallet'
    if (isWrongChain) return `Switch to ${getChainConfig(fromChainId)?.name ?? 'the right chain'}`
    if (!selectedSymbol) return 'Select asset'
    if (!amount || !fromWeiAmount) return 'Enter an amount'
    if (insufficientBalance) return 'Insufficient balance'
    if (executionStatus === 'approving') return 'Approving…'
    if (executionStatus === 'executing') return 'Bridging…'
    if (executionStatus === 'bridging') return 'Bridging…'
    if (executionStatus === 'success') return 'Bridged'
    if (!bestQuote) {
      if (noRouteReason === 'unsupported-pair') return 'Route not supported'
      if (noRouteReason === 'no-liquidity') return 'No liquidity found'
      return 'No route found'
    }
    return `Bridge ${selectedSymbol}`
  })()

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--ink-3)]">Bridge</span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <ChainSelect chains={CHAINS} selectedChainId={fromChainId} onSelect={handleChangeFromChainId} label="From" />
            <ChainSelect
              chains={CHAINS}
              selectedChainId={toChainId}
              onSelect={handleChangeToChainId}
              excludeChainId={fromChainId}
              label="To"
            />
          </div>

          <div className="flex flex-wrap gap-2 px-1">
            {availableSymbols.map(symbol => {
              const isSelected = symbol === selectedSymbol
              return (
                <button
                  key={symbol}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedSymbol(symbol)}
                  className={
                    isSelected
                      ? 'rounded-full border border-[var(--accent)] bg-[var(--accent-wash)] px-3 py-1 text-sm font-medium text-[var(--accent)]'
                      : 'rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1 text-sm font-medium text-[var(--ink)] hover:border-[var(--line-strong)]'
                  }
                >
                  {symbol}
                </button>
              )
            })}
          </div>

          <TokenInput
            label="You send"
            amount={amount}
            onAmountChange={setAmount}
            token={fromToken}
            onTokenClick={() => {}}
            balance={fromBalance}
          />

          <TokenInput
            label="You receive"
            amount={toAmountDisplay}
            token={toToken}
            onTokenClick={() => {}}
            isLoadingAmount={isQuoteLoading && Boolean(quoteRequest)}
            readOnly
          />
        </div>

        <Button
          className="mt-3 w-full"
          variant="primary"
          size="lg"
          disabled={isWrongChain ? isSwitchingChain : !canBridge}
          isLoading={
            (isWrongChain && isSwitchingChain) ||
            executionStatus === 'approving' || executionStatus === 'executing' || executionStatus === 'bridging'
          }
          onClick={isWrongChain ? handleSwitchChain : handleBridgeClick}
        >
          {bridgeButtonLabel}
        </Button>

        {executionStatus === 'rejected' && (
          <p className="mt-2 text-center text-sm text-[var(--ink-3)]">Cancelled in wallet.</p>
        )}
      </div>

      {executionStatus !== 'idle' && (
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
          <TransferProgress
            steps={buildTransferSteps(executionStatus)}
            currentError={executionStatus === 'error' ? executionError : null}
          />
        </div>
      )}
    </div>
  )
}
