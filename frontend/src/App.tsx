import { useState, useEffect, useCallback } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import { useWallet } from './hooks/useWallet'
import { useBridge } from './hooks/useBridge'
import Navbar from './components/Navbar'
import HeroSection from './components/HeroSection'
import ChainSelector from './components/ChainSelector'
import TokenList from './components/TokenList'
import BridgeActions from './components/BridgeActions'
import TxHistory from './components/TxHistory'
import { Toast } from './components/UI'
import Portfolio from './components/Portfolio'
import SwapCard from './components/swap/SwapCard'
import { getChainById } from './wagmi'
import { SLIPPAGE_PRESETS, formatUsd } from './bridgeService'
import { t, setLocale, getLocale, initLocale } from './i18n'
import CookieBanner from './components/CookieBanner'
import type { AppRoute } from './types'

initLocale()

function getRouteFromHash(): AppRoute {
  if (typeof window === 'undefined') return 'swap'
  const hash = window.location.hash.replace('#/', '').replace('#', '')
  if (['swap', 'bridge', 'portfolio', 'analytics'].includes(hash)) return hash as AppRoute
  return 'swap'
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(getRouteFromHash)
  const [showTxHistory, setShowTxHistory] = useState(false)
  const [txHistoryRefresh, setTxHistoryRefresh] = useState(0)
  const [locale, setLocaleState] = useState(getLocale())

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigateTo = useCallback((r: AppRoute) => {
    window.location.hash = `/${r}`
    setRoute(r)
  }, [])

  const wallet = useWallet()
  const bridge = useBridge({
    address: wallet.address,
    isConnected: wallet.isConnected,
    connectionStatus: wallet.connectionStatus,
  })

  const handleBridge = async () => {
    await bridge.handleBridge({
      walletClient: wallet.walletClient,
      sendCallsAsync: wallet.sendCallsAsync,
      resetBatchCalls: wallet.resetBatchCalls,
      switchChainAsync: wallet.switchChainAsync,
      connectedChainId: wallet.connectedChainId,
      walletCapabilities: wallet.walletCapabilities,
      DATA_SUFFIX: wallet.DATA_SUFFIX,
    })
    setTxHistoryRefresh(n => n + 1)
  }

  const handleSlippage = (val: number) => bridge.setSlippage(val)
  const handleCustomSlippage = (val: string) => {
    bridge.setCustomSlippage(val)
    if (!val) { bridge.setSlippage(null); return }
    const parsed = Number(val)
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(Math.max(parsed, 0.01), 50)
      bridge.setSlippage(Math.round(clamped * 100))
    }
  }

  const switchLocale = (l: string) => { setLocale(l); setLocaleState(l) }

  return (
    <div className={`app-container ${wallet.isConnected ? 'connected' : ''} hero-gradient`}>
      <Navbar
        route={route}
        onRouteChange={navigateTo}
        isConnected={wallet.isConnected}
        address={wallet.address}
        connectedChainId={wallet.connectedChainId}
        openWallet={wallet.openWallet}
        openNetworks={wallet.openNetworks}
        disconnectWallet={wallet.disconnectWallet}
        locale={locale}
        onLocaleChange={switchLocale}
      />

      <main className="main-content">
        {!wallet.isConnected && route !== 'analytics' ? (
          <HeroSection onConnect={wallet.openWallet} />
        ) : (
          <>
            {route === 'swap' && <SwapCard />}

            {route === 'bridge' && (
              <div className="bridge-container glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius)' }}>
                <details className="portfolio-collapse">
                  <summary className="portfolio-summary">📊 {t('portfolio')} — {formatUsd(bridge.selectedTotal || bridge.holdings.reduce((s: number, t: any) => s + (t.valueUsd || 0), 0))}</summary>
                  <Portfolio
                    holdings={bridge.holdings}
                    sourceChain={bridge.sourceChain}
                    selectedTokens={bridge.selectedTokens}
                    onSelectToken={(token: any) => {
                      if (!bridge.outputToken) { bridge.showToast('Select output token first'); return }
                      bridge.toggleToken(token)
                    }}
                  />
                </details>
                <ChainSelector
                  sourceChain={bridge.sourceChain}
                  destChain={bridge.destChain}
                  onSourceChange={(id: number) => {
                    bridge.setSourceChain(id)
                    bridge.setSelectedTokens(new Map())
                    bridge.setQuote(null)
                  }}
                  onDestChange={(id: number) => {
                    bridge.setDestChain(id)
                    bridge.setOutputToken(null)
                    bridge.setCustomTokens([])
                    bridge.setQuote(null)
                  }}
                  onSwap={bridge.handleSwapChains}
                  disabled={bridge.isBridging}
                />

                <div className="bridge-panels">
                  <TokenList
                    isOutput
                    outputTokens={bridge.outputTokens}
                    customTokens={bridge.customTokens}
                    outputToken={bridge.outputToken}
                    onOutputTokenSelect={bridge.handleOutputTokenSelect}
                    customAddress={bridge.customTokenAddress}
                    onCustomAddressChange={bridge.setCustomTokenAddress}
                    onCustomAdd={bridge.handleAddCustomToken}
                    isAddingCustom={bridge.isLoadingCustomToken}
                    getChainById={getChainById}
                  />
                  <TokenList
                    tokens={bridge.holdings}
                    outputToken={bridge.outputToken}
                    selectedTokens={bridge.selectedTokens}
                    isChecking={bridge.isCheckingRoutes}
                    isLoading={bridge.isLoadingHoldings}
                    sourceChain={bridge.sourceChain}
                    getChainById={getChainById}
                    onRefresh={bridge.loadHoldings}
                    onToggleToken={bridge.toggleToken}
                    onUpdateAmount={bridge.updateTokenAmount}
                    onSetMax={bridge.setMaxAmount}
                    getBlockedReason={bridge.getBlockedReason}
                    activeSelectionCount={bridge.activeSelectionCount}
                    selectedTotal={bridge.selectedTotal}
                    MAX_BATCH_TOKENS={bridge.MAX_BATCH_TOKENS}
                    showToast={bridge.showToast}
                    customSourceAddress={bridge.customSourceTokenAddress}
                    onCustomSourceAddressChange={bridge.setCustomSourceTokenAddress}
                    onCustomSourceAdd={bridge.handleAddSourceToken}
                    isAddingSource={bridge.isLoadingSourceToken}
                  />
                </div>

                <BridgeActions
                  activeSelectionCount={bridge.activeSelectionCount}
                  MAX_BATCH_TOKENS={bridge.MAX_BATCH_TOKENS}
                  selectedTokens={bridge.selectedTokens}
                  outputToken={bridge.outputToken}
                  quote={bridge.quote}
                  isLoadingQuote={bridge.isLoadingQuote}
                  isBridging={bridge.isBridging}
                  slippage={bridge.slippage}
                  customSlippage={bridge.customSlippage}
                  onSlippageChange={handleSlippage}
                  onCustomSlippageChange={handleCustomSlippage}
                  onGetQuote={bridge.handleGetQuote}
                  onBridge={handleBridge}
                  onBridgeAgain={bridge.handleBridgeAgain}
                  onClose={bridge.handleCloseBridgePanel}
                  getOutputAmount={bridge.getOutputAmount}
                  getFees={bridge.getFees}
                  status={bridge.status}
                  bridgeProgress={bridge.bridgeProgress}
                  bridgePanelMode={bridge.bridgePanelMode}
                  successPanel={bridge.successPanel}
                  SLIPPAGE_PRESETS={SLIPPAGE_PRESETS}
                />
              </div>
            )}

            {route === 'portfolio' && (
              <div className="placeholder-page glass-card">
                <h2>Portfolio</h2>
                <p className="text-secondary">Multi-chain portfolio dashboard coming soon.</p>
                <p className="text-muted">Track your holdings across Ethereum, Base, Arbitrum, Optimism, and Polygon.</p>
              </div>
            )}

            {route === 'analytics' && (
              <div className="placeholder-page glass-card">
                <h2>Analytics</h2>
                <p className="text-secondary">Market analytics and charts coming soon.</p>
                <p className="text-muted">Track top movers, gas prices, and DeFi pool data.</p>
              </div>
            )}
          </>
        )}
      </main>

      <nav className="mobile-nav">
        <div className="mobile-nav-items">
          {[
            { id: 'swap' as AppRoute, label: 'Swap', icon: <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></> },
            { id: 'bridge' as AppRoute, label: 'Bridge', icon: <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /></> },
            { id: 'portfolio' as AppRoute, label: 'Portfolio', icon: <><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></> },
            { id: 'analytics' as AppRoute, label: 'Analytics', icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></> },
          ].map(item => (
            <button
              key={item.id}
              className={`mobile-nav-btn ${route === item.id ? 'active' : ''}`}
              onClick={() => navigateTo(item.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </svg>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-text">© 2025 BatchBridge.xyz — Swap · Bridge · Portfolio · Non-custodial</div>
          <div className="footer-links">
            <a href="/tos.html">Terms</a> · <a href="/privacy.html">Privacy</a> · {' '}
            Powered by <a href="https://relay.link" target="_blank" rel="noopener noreferrer">Relay</a>
            {' · '}<a href="https://paraswap.io" target="_blank" rel="noopener noreferrer">ParaSwap</a>
          </div>
        </div>
      </footer>

      <CookieBanner />

      {bridge.isCheckingRoutes && (
        <div className="overlay" role="status" aria-live="polite">
          <div className="overlay-card">
            <svg className="spin-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <div className="overlay-title">{t('quote.gettingQuote')}</div>
            <div className="overlay-sub">Finding best path to {bridge.outputToken?.symbol || 'token'}...</div>
          </div>
        </div>
      )}

      <TxHistory visible={showTxHistory} onClose={() => setShowTxHistory(false)} triggerRefresh={txHistoryRefresh} />
      <Toast message={bridge.toast} />
      <SpeedInsights />
      <Analytics />
    </div>
  )
}
