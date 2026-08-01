import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { ChainSelect } from '../ChainSelect'
import type { ChainSelectProps } from '../ChainSelect'
import type { ChainConfig } from '../../../config/chains'

// vitest.config.ts sets `globals: false`, so @testing-library/react's
// automatic afterEach cleanup (which relies on a global `afterEach`) never
// registers - wire it up explicitly so each test starts with a fresh DOM.
afterEach(cleanup)

const fixtureChains: ChainConfig[] = [
  {
    id: 1,
    name: 'Ethereum',
    nativeSymbol: 'ETH',
    logo: 'https://example.com/eth.jpg',
    explorer: 'https://etherscan.io',
    rpcUrls: ['https://example.com/rpc'],
    blockscoutUrl: null,
    multicall3Address: '0x0',
  },
  {
    id: 137,
    name: 'Polygon',
    nativeSymbol: 'POL',
    logo: 'https://example.com/polygon.jpg',
    explorer: 'https://polygonscan.com',
    rpcUrls: ['https://example.com/rpc'],
    blockscoutUrl: null,
    multicall3Address: '0x0',
  },
  {
    id: 8453,
    name: 'Base',
    nativeSymbol: 'ETH',
    logo: 'https://example.com/base.jpg',
    explorer: 'https://basescan.org',
    rpcUrls: ['https://example.com/rpc'],
    blockscoutUrl: null,
    multicall3Address: '0x0',
  },
]

function renderChainSelect(overrides: Partial<ChainSelectProps> = {}) {
  const props: ChainSelectProps = {
    chains: fixtureChains,
    selectedChainId: 1,
    onSelect: vi.fn(),
    ...overrides,
  }
  render(<ChainSelect {...props} />)
  return props
}

function openDropdown() {
  fireEvent.click(screen.getByRole('button', { name: /Ethereum/i }))
}

describe('ChainSelect', () => {
  it('shows the selected chain name on the trigger', () => {
    renderChainSelect({ selectedChainId: 137 })

    expect(screen.getByRole('button', { name: /Polygon/i })).toBeInTheDocument()
  })

  it('opens the dropdown listing all provided chains on click', () => {
    renderChainSelect()

    openDropdown()

    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getByText('Ethereum')).toBeInTheDocument()
    expect(within(listbox).getByText('Polygon')).toBeInTheDocument()
    expect(within(listbox).getByText('Base')).toBeInTheDocument()
  })

  it('excludes excludeChainId from the visible options entirely', () => {
    renderChainSelect({ excludeChainId: 137 })

    openDropdown()

    const listbox = screen.getByRole('listbox')
    expect(within(listbox).queryByText('Polygon')).not.toBeInTheDocument()
    expect(within(listbox).getByText('Ethereum')).toBeInTheDocument()
    expect(within(listbox).getByText('Base')).toBeInTheDocument()
  })

  it('calls onSelect with the chosen chainId and closes the dropdown', () => {
    const props = renderChainSelect()

    openDropdown()
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Base'))

    expect(props.onSelect).toHaveBeenCalledWith(8453)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes on Escape without calling onSelect', () => {
    const props = renderChainSelect()

    openDropdown()
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(props.onSelect).not.toHaveBeenCalled()
  })
})
