import { useState, useEffect } from 'react'
import { formatUsd } from '../bridgeService'
import { BRIDGE_CHAINS } from '../wagmi'

export default function Portfolio({ holdings, sourceChain, onSelectToken, selectedTokens, outputToken }) {
  const totalValue = holdings.reduce((sum, t) => sum + (t.valueUsd || 0), 0)
  const topTokens = [...holdings].sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 5)

  const chainInfo = BRIDGE_CHAINS.find(c => c.id === sourceChain)

  return (
    <div className="portfolio-card">
      <div className="portfolio-header">
        <h3>Portfolio</h3>
        <span className="portfolio-total">{formatUsd(totalValue)}</span>
      </div>
      <div className="portfolio-chain">
        <img src={chainInfo?.logo} alt="" className="chain-logo-sm" />
        <span>{chainInfo?.name}</span>
      </div>
      <div className="portfolio-tokens">
        {topTokens.map(token => (
          <div key={token.address}
            className={`portfolio-token ${selectedTokens?.has(token.address) ? 'selected' : ''}`}
            onClick={() => onSelectToken?.(token)}
          >
            <div className="pt-info">
              <span className="pt-symbol">{token.symbol}</span>
              <span className="pt-balance">{token.balanceFormatted}</span>
            </div>
            <span className="pt-value">{formatUsd(token.valueUsd)}</span>
          </div>
        ))}
        {holdings.length > 5 && (
          <div className="portfolio-more">+{holdings.length - 5} more tokens</div>
        )}
      </div>
    </div>
  )
}
