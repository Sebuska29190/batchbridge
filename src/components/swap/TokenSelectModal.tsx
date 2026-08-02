import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

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

  // The row list changes shape whenever the search query changes - an index
  // that was valid for the old list may point past the end of a shorter
  // filtered one, so keyboard focus resets to the top each time. This only
  // updates state (no DOM focus call), so it never steals focus from the
  // search input while the user is still typing.
  useEffect(() => {
    setActiveIndex(0)
  }, [rows.length])

  // Scrolls `index` into view (rows outside the overscan window aren't
  // mounted yet) then focuses it once React commits the newly-rendered
  // button. Only called from an explicit key press below - never from an
  // effect - so it can't fire on mount or steal focus from the search input.
  const focusRowAtIndex = (index: number) => {
    virtualizer.scrollToIndex(index, { align: 'auto' })
    requestAnimationFrame(() => {
      optionRefs.current.get(index)?.focus()
    })
  }

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (rows.length === 0) return
    let nextIndex: number | null = null
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = Math.min(activeIndex + 1, rows.length - 1)
        break
      case 'ArrowUp':
        nextIndex = Math.max(activeIndex - 1, 0)
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = rows.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    setActiveIndex(nextIndex)
    focusRowAtIndex(nextIndex)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a token">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // ArrowDown from the search box hands keyboard focus straight to
          // the list, instead of requiring an extra Tab press first.
          if (event.key === 'ArrowDown' && rows.length > 0) {
            event.preventDefault()
            focusRowAtIndex(activeIndex)
          }
        }}
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
          <div ref={scrollContainerRef} className="max-h-96 overflow-y-auto" onKeyDown={handleListKeyDown}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const token = rows[virtualRow.index]
                const held = heldByAddress.get(token.address.toLowerCase())
                const isActive = virtualRow.index === activeIndex
                return (
                  <button
                    key={token.address}
                    ref={(el) => {
                      if (el) optionRefs.current.set(virtualRow.index, el)
                      else optionRefs.current.delete(virtualRow.index)
                    }}
                    type="button"
                    tabIndex={isActive ? 0 : -1}
                    onFocus={() => setActiveIndex(virtualRow.index)}
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
