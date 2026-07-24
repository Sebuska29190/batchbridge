'use client'

import type { WidgetConfig } from '@lifi/widget'
import { LiFiWidget, WidgetSkeleton } from '@lifi/widget'
import { ClientOnly } from './client-only'

const config = {
  appearance: 'dark',
  theme: {
    colorSchemes: {
      dark: {
        palette: {
          primary: { main: '#3898ff' },
          background: { default: '#06080b', paper: '#0d111a' },
        },
      },
    },
    container: {
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
    },
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
