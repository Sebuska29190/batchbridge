import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BatchBridge | Multi-Chain DEX & Bridge',
  description: 'Swap and bridge tokens across 20+ chains at the best rates. Cross-chain swaps powered by LI.FI.',
  openGraph: {
    title: 'BatchBridge | Multi-Chain DEX & Bridge',
    description: 'Swap and bridge tokens across 20+ chains at the best rates.',
    url: 'https://batchbridge.xyz',
    siteName: 'BatchBridge',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, fontFamily: 'Inter, -apple-system, sans-serif', background: '#06080b', color: '#f1f4f9' }}>
        {children}
      </body>
    </html>
  )
}
