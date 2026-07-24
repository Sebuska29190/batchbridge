'use client'

import type { WidgetConfig } from '@lifi/widget'
import { LiFiWidget, WidgetSkeleton } from '@lifi/widget'
import { useState, useEffect } from 'react'

function ClientOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted ? children : (fallback || null)
}

const config = {
  appearance: 'dark',
  walletConfig: {
    forceInternalWalletManagement: true,
  },
} as Partial<WidgetConfig>

export function WidgetPage() {
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <ClientOnly fallback={<WidgetSkeleton config={config} />}>
        <LiFiWidget config={config} integrator="batchbridge.xyz" />
      </ClientOnly>
    </div>
  )
}
