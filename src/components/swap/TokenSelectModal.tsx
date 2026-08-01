import React, { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Modal } from '../common/Modal'
import { TokenIcon } from '../common/TokenIcon'
import { Skeleton } from '../common/Skeleton'
import { useTokenList, useCustomTokenLookup } from '../../hooks/useTokenList'
import { useHeldTokens } from '../../hooks/useBalances'
import type { Token } from '../../services/tokenRegistry'
import type { HeldToken } from '../../services/balances'

export interface TokenSelectModalProps {
  isOpen: boolean
  onClose: () => void
  chainId: number
  mode: 'swap' | 'bridge' // which token list this picker draws from - passed straight to useTokenList
  ownerAddress?: string // for showing/prioritizing held balances, optional (no wallet connected yet is a valid state)
  onSelect: (token: Token) => void
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const ROW_HEIGHT = 60

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  chainId,
  mode,
  ownerAddress,
  onSelect,
}) => {
  const [query, setQuery] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const trimmedQuery = query.trim()
  const isAddressQuery = ADDRESS_RE.test(trimmedQuery)

  const tokenListQuery = useTokenList(chainId, mode)
  const heldTokensQuery = useHeldTokens(chainId, ownerAddress)
  const customTokenQuery = useCustomTokenLookup(chainId, isAddressQuery ? trimmedQuery : undefined)

  const heldByAddress = useMemo(() => {
    const map = new Map<string, HeldToken>()
    for (const held of heldTokensQuery.data ?? []) {
      map.set(held.address.toLowerCase(), held)
    }
    return map
  }, [heldTokensQuery.data])

  const rows = useMemo(() => {
    const tokens = tokenListQuery.data ?? []
    const q = trimmedQuery.toLowerCase()
    const filtered = q
      ? tokens.filter(
          (token) => token.symbol.toLowerCase().includes(q) || token.name.toLowerCase().includes(q)
        )
      : tokens

    if (heldByAddress.size === 0) return filtered

    const held: Token[] = []
    const rest: Token[] = []
    for (const token of filtered) {
      if (heldByAddress.has(token.address.toLowerCase())) held.push(token)
      else rest.push(token)
    }
    held.sort(
      (a, b) =>
        (heldByAddress.get(b.address.toLowerCase())?.valueUsd ?? 0) -
        (heldByAddress.get(a.address.toLowerCase())?.valueUsd ?? 0)
    )

    return [...held, ...rest]
  }, [tokenListQuery.data, heldByAddress, trimmedQuery])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  const handleSelect = (token: Token) => {
    onSelect(token)
    onClose()
  }

  const isListLoading = tokenListQuery.isLoading || (Boolean(ownerAddress) && heldTokensQuery.isLoading)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a token">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name or paste address"
        aria-label="Search tokens"
        className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--line-strong)]"
      />

      <div className="mt-3">
        {isAddressQuery ? (
          customTokenQuery.isLoading ? (
            <Skeleton height={48} />
          ) : customTokenQuery.data ? (
            <button
              type="button"
              onClick={() => handleSelect(customTokenQuery.data as Token)}
              className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left hover:bg-[var(--surface-2)]"
            >
              <TokenIcon symbol={customTokenQuery.data.symbol} logoURI={customTokenQuery.data.logoURI} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--ink)]">{customTokenQuery.data.symbol}</span>
                <span className="block truncate text-sm text-[var(--ink-3)]">{customTokenQuery.data.name}</span>
              </span>
              {customTokenQuery.data.lowLiquidity && (
                <span className="shrink-0 rounded-full bg-[var(--accent-wash)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                  Low liquidity
                </span>
              )}
            </button>
          ) : (
            <p className="px-3 py-4 text-sm text-[var(--ink-3)]">No token found at this address.</p>
          )
        ) : isListLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} height={ROW_HEIGHT - 8} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-sm text-[var(--ink-3)]">No tokens found.</p>
        ) : (
          <div ref={scrollContainerRef} className="max-h-96 overflow-y-auto">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const token = rows[virtualRow.index]
                const held = heldByAddress.get(token.address.toLowerCase())
                return (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => handleSelect(token)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-center gap-3 px-3 text-left hover:bg-[var(--surface-2)]"
                  >
                    <TokenIcon symbol={token.symbol} logoURI={token.logoURI} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[var(--ink)]">{token.symbol}</span>
                      <span className="block truncate text-sm text-[var(--ink-3)]">{token.name}</span>
                    </span>
                    {held && (
                      <span className="num shrink-0 text-right text-sm text-[var(--ink-2)]">
                        <span className="block">{held.balance}</span>
                        <span className="block text-[var(--ink-3)]">${held.valueUsd.toFixed(2)}</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
