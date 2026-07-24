'use client'

import dynamic from 'next/dynamic'

const LiFiWidget = dynamic(
  () => import('@lifi/widget').then(mod => mod.LiFiWidget),
  { ssr: false }
)

export function WidgetPage() {
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <LiFiWidget
        config={{
          appearance: 'dark',
          containerStyle: {
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '420px',
          },
        }}
        integrator="batchbridge.xyz"
      />
    </div>
  )
}
