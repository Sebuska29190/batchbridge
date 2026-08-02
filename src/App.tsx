import { useCallback, useEffect, useState } from 'react'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { useAccount } from 'wagmi'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import { Navbar } from './components/layout/Navbar'
import type { AppMode } from './components/layout/Navbar'
import { SwapCard } from './components/swap/SwapCard'
import { BridgeCard } from './components/bridge/BridgeCard'
import { BatchCard } from './components/batch/BatchCard'

const VALID_MODES: AppMode[] = ['swap', 'bridge', 'batch']

function readModeFromUrl(): AppMode {
  const param = new URLSearchParams(window.location.search).get('mode')
  return (VALID_MODES as string[]).includes(param ?? '') ? (param as AppMode) : 'swap'
}

/**
 * Mode is synced to `?mode=` rather than kept in local state alone so a
 * direct link (or a page refresh mid-session) lands on the same tab the
 * user left, matching Task 36's routing requirement.
 */
function writeModeToUrl(mode: AppMode) {
  const url = new URL(window.location.href)
  url.searchParams.set('mode', mode)
  window.history.replaceState(null, '', url)
}

export default function App() {
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const { address, isConnected } = useAccount()

  const [mode, setMode] = useState<AppMode>(() => readModeFromUrl())

  useEffect(() => {
    writeModeToUrl(mode)
  }, [mode])

  useEffect(() => {
    const onPopState = () => setMode(readModeFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const handleModeChange = useCallback((nextMode: AppMode) => setMode(nextMode), [])
  const handleConnectClick = useCallback(() => open(), [open])
  const handleDisconnectClick = useCallback(() => disconnect(), [disconnect])

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar
        mode={mode}
        onModeChange={handleModeChange}
        isConnected={isConnected}
        address={address}
        onConnectClick={handleConnectClick}
        onDisconnectClick={handleDisconnectClick}
      />

      <main className="mx-auto flex max-w-lg flex-col px-4 py-8">
        {mode === 'swap' && <SwapCard />}
        {mode === 'bridge' && <BridgeCard />}
        {mode === 'batch' && <BatchCard />}
      </main>

      <SpeedInsights />
      <Analytics />
    </div>
  )
}
