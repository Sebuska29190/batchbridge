import React, { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { Button } from '../common/Button'
import { TokenIcon } from '../common/TokenIcon'
import { Skeleton } from '../common/Skeleton'
import { ChainSelect } from '../bridge/ChainSelect'
import { useHeldTokens } from '../../hooks/useBalances'
import { useBatchQuote, type BatchQuoteRequest } from '../../hooks/useBatchQuote'
import { getBridgeableTokens } from '../../config/bridgeableAssets'
import { CHAINS } from '../../config/chains'

const DEFAULT_FROM_CHAIN_ID = CHAINS[0].id
const DEFAULT_TO_CHAIN_ID = CHAINS[1]?.id ?? CHAINS[0].id

/**
 * Batch mode: bridge several tokens held on one chain into a single
 * destination token in one operation (e.g. leftover USDC + DAI + a small ETH
 * balance on Base, all consolidated into USDC on Arbitrum). Only a Relay
 * multi-input quote exists for this - no aggregator racing, no
 * quote-comparison UI (matches the design doc: batch mode intentionally has
 * no offer comparison section).
 */
export const BatchCard: React.FC = () => {
  const { address, isConnected } = useAccount()

  const [fromChainId, setFromChainId] = useState(DEFAULT_FROM_CHAIN_ID)
  const [toChainId, setToChainId] = useState(DEFAULT_TO_CHAIN_ID)
  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(new Set())
  const [destinationAddress, setDestinationAddress] = useState<string | null>(null)

  const { data: heldTokens, isLoading: isHeldTokensLoading } = useHeldTokens(fromChainId, address)
  const tokens = heldTokens ?? []

  const destinationOptions = useMemo(() => getBridgeableTokens(toChainId), [toChainId])
  const destinationToken = destinationOptions.find(t => t.address === destinationAddress) ?? null

  const selectedTokens = useMemo(
    () => tokens.filter(token => selectedAddresses.has(token.address)),
    [tokens, selectedAddresses],
  )
  const totalUsd = useMemo(
    () => selectedTokens.reduce((sum, token) => sum + token.valueUsd, 0),
    [selectedTokens],
  )

  const handleFromChainSelect = (chainId: number) => {
    setFromChainId(chainId)
    setSelectedAddresses(new Set())
    if (chainId === toChainId) {
      const fallback = CHAINS.find(c => c.id !== chainId)
      if (fallback) {
        setToChainId(fallback.id)
        setDestinationAddress(null)
      }
    }
  }

  const handleToChainSelect = (chainId: number) => {
    setToChainId(chainId)
    setDestinationAddress(null)
  }

  const toggleToken = (tokenAddress: string) => {
    setSelectedAddresses(prev => {
      const next = new Set(prev)
      if (next.has(tokenAddress)) next.delete(tokenAddress)
      else next.add(tokenAddress)
      return next
    })
  }

  const batchQuoteRequest: BatchQuoteRequest | null = useMemo(() => {
    if (!address || selectedTokens.length === 0 || !destinationToken) return null
    return {
      user: address,
      origins: selectedTokens.map(token => ({
        chainId: fromChainId,
        currency: token.address,
        amount: token.balance,
      })),
      destinationChainId: toChainId,
      destinationCurrency: destinationToken.address,
    }
  }, [address, selectedTokens, fromChainId, toChainId, destinationToken])

  const { data: quote, isLoading: isQuoteLoading, isError: isQuoteError } = useBatchQuote(batchQuoteRequest)

  // Relay's multi-input response shares the same `details.currencyOut` shape
  // used elsewhere in bridgeService.ts (see getAggregatedSwapQuotes, which
  // reads amountFormatted/amountUsd off the same path) - amountFormatted is
  // the one field confidently identified there. The output currency's symbol
  // is already known locally (destinationToken.symbol) rather than guessed
  // from the response's `currency` field, whose shape wasn't confidently
  // identifiable from what's in this codebase.
  const outputAmountFormatted: string | undefined = quote?.details?.currencyOut?.amountFormatted
  const outputAmountUsd: string | undefined = quote?.details?.currencyOut?.amountUsd

  const canExecute = isConnected && selectedTokens.length > 0 && Boolean(destinationToken)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--ink-3)]">Batch</span>
        </div>

        <div className="flex flex-col gap-3">
          <ChainSelect
            chains={CHAINS}
            selectedChainId={fromChainId}
            onSelect={handleFromChainSelect}
            label="From"
          />

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--ink-3)]">Tokens to bridge</div>

            {!isConnected && (
              <p className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm text-[var(--ink-3)]">
                Connect your wallet to see held tokens.
              </p>
            )}

            {isConnected && isHeldTokensLoading && (
              <div className="flex flex-col gap-2">
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            )}

            {isConnected && !isHeldTokensLoading && tokens.length === 0 && (
              <p className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm text-[var(--ink-3)]">
                No tokens found on this chain.
              </p>
            )}

            {isConnected && !isHeldTokensLoading && tokens.length > 0 && (
              <ul className="flex flex-col gap-1">
                {tokens.map(token => {
                  const isSelected = selectedAddresses.has(token.address)
                  const humanBalance = formatUnits(BigInt(token.balance), token.decimals)
                  return (
                    <li key={token.address}>
                      <label className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-2 hover:border-[var(--line-strong)]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleToken(token.address)}
                          aria-label={`Include ${token.symbol}`}
                        />
                        <TokenIcon symbol={token.symbol} size={24} />
                        <span className="flex-1 text-sm text-[var(--ink)]">{token.symbol}</span>
                        <span className="num text-sm text-[var(--ink-2)]">{humanBalance}</span>
                        <span className="num text-sm text-[var(--ink-3)]">${token.valueUsd.toFixed(2)}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius-sm)] bg-[var(--accent-wash)] p-3 text-sm text-[var(--ink)]">
            Bridging ≈ <span className="num font-medium">${totalUsd.toFixed(2)}</span> across{' '}
            <span className="num font-medium">{selectedTokens.length}</span>{' '}
            {selectedTokens.length === 1 ? 'token' : 'tokens'}
          </div>

          <ChainSelect
            chains={CHAINS}
            selectedChainId={toChainId}
            onSelect={handleToChainSelect}
            excludeChainId={fromChainId}
            label="To"
          />

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--ink-3)]">Receive as</div>
            <div className="flex flex-wrap gap-2">
              {destinationOptions.map(token => {
                const isSelected = token.address === destinationAddress
                return (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => setDestinationAddress(token.address)}
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? 'rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-ink)]'
                        : 'rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--ink)] hover:border-[var(--line-strong)]'
                    }
                  >
                    {token.symbol}
                  </button>
                )
              })}
            </div>
          </div>

          {batchQuoteRequest && (
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
              {isQuoteLoading && <Skeleton height={20} />}
              {!isQuoteLoading && isQuoteError && (
                <span className="text-[var(--neg)]">Couldn't fetch a batch quote.</span>
              )}
              {!isQuoteLoading && !isQuoteError && quote && (
                <span className="text-[var(--ink)]">
                  {outputAmountFormatted !== undefined ? (
                    <>
                      You receive{' '}
                      <span className="num font-medium">
                        {outputAmountFormatted} {destinationToken?.symbol}
                      </span>
                      {outputAmountUsd !== undefined && (
                        <span className="num text-[var(--ink-3)]"> (${outputAmountUsd})</span>
                      )}
                    </>
                  ) : (
                    'Quote ready'
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        <Button className="mt-3 w-full" variant="primary" size="lg" disabled={!canExecute}>
          {!isConnected ? 'Connect wallet' : 'Execute batch'}
        </Button>
      </div>
    </div>
  )
}
