'use client'

import type { WidgetConfig } from '@lifi/widget'
import { LiFiWidget, WidgetSkeleton } from '@lifi/widget'
import { ClientOnly } from './client-only'

const config = {
  appearance: 'dark',
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
