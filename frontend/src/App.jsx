import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import { useWallet } from './hooks/useWallet'
import { useBridge } from './hooks/useBridge'
import Navbar from './components/Navbar'
import HeroSection from './components/HeroSection'
import ChainSelector from './components/ChainSelector'
import TokenList from './components/TokenList'
import BridgeActions from './components/BridgeActions'
import { Toast } from './components/UI'
import { getChainById, BRIDGE_CHAINS, COMMON_TOKENS } from './wagmi'
import { SLIPPAGE_PRESETS } from './bridgeService'

export default function App() {
  const wallet = useWallet()
  const bridge = useBridge({
    address: wallet.address,
    isConnected: wallet.isConnected,
    connectionStatus: wallet.connectionStatus,
  })

  const handleBridge = () => bridge.handleBridge({
    walletClient: wallet.walletClient,
    sendCallsAsync: wallet.sendCallsAsync,
    resetBatchCalls: wallet.resetBatchCalls,
    switchChainAsync: wallet.switchChainAsync,
    connectedChainId: wallet.connectedChainId,
    walletCapabilities: wallet.walletCapabilities,
    DATA_SUFFIX: wallet.DATA_SUFFIX,
  })

  const handleSlippage = (val) => bridge.setSlippage(val)
  const handleCustomSlippage = (val) => {
    bridge.setCustomSlippage(val)
    if (!val) { bridge.setSlippage(null); return }
    const parsed = Number(val)
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(Math.max(parsed, 0.01), 50)
      bridge.setSlippage(Math.round(clamped * 100))
    }
  }

  return (
    <div className={`app-container ${wallet.isConnected ? 'connected' : ''}`}>
      <Navbar
        isConnected={wallet.isConnected}
        address={wallet.address}
        connectedChainId={wallet.connectedChainId}
        openWallet={wallet.openWallet}
        openNetworks={wallet.openNetworks}
        disconnectWallet={wallet.disconnectWallet}
      />

      <main className="main-content">
        {!wallet.isConnected ? (
          <HeroSection onConnect={wallet.openWallet} />
        ) : (
          <div className="bridge-container">
            <ChainSelector
              sourceChain={bridge.sourceChain}
              destChain={bridge.destChain}
              onSourceChange={(id) => {
                bridge.setSourceChain(id)
                bridge.setSelectedTokens(new Map())
                bridge.setQuote(null)
              }}
              onDestChange={(id) => {
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
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-text">
            © 2025 BatchBridge.xyz — Non-custodial Bridge Interface.
            All transactions are executed via decentralized protocols.
          </div>
          <div className="footer-links">
            Built with <a href="https://relay.link" target="_blank" rel="noopener noreferrer">Relay</a>
            {' · '}Data by <a href="https://routescan.io" target="_blank" rel="noopener noreferrer">Routescan</a>
          </div>
        </div>
      </footer>

      {bridge.isCheckingRoutes && (
        <div className="overlay" role="status" aria-live="polite">
          <div className="overlay-card">
            <svg className="spin-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <div className="overlay-title">Checking routes</div>
            <div className="overlay-sub">Finding the best path to {bridge.outputToken?.symbol || 'your token'}...</div>
          </div>
        </div>
      )}

      <Toast message={bridge.toast} />
      <SpeedInsights />
      <Analytics />
    </div>
  )
}
