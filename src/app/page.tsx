'use client'

import { AppProvider } from './providers'
import { WidgetPage } from './widget'

export default function Home() {
  return (
    <AppProvider>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <header style={{
          width: '100%',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28,
              background: 'linear-gradient(135deg, #3898ff, #6366f1)',
              borderRadius: 8, padding: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>
              Batch<span style={{ color: '#3898ff' }}>Bridge</span>
            </span>
          </div>
          <nav style={{ display: 'flex', gap: 24, fontSize: 14, fontWeight: 500 }}>
            <a href="https://batchbridge.xyz" style={{ color: '#3898ff', textDecoration: 'none' }}>Swap</a>
            <a href="https://github.com/Sebuska29190/batchbridge" style={{ color: '#8b93a4', textDecoration: 'none' }} target="_blank" rel="noopener">GitHub</a>
          </nav>
        </header>

        <main style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 16px',
          width: '100%',
          maxWidth: 480,
        }}>
          <WidgetPage />
        </main>

        <footer style={{
          width: '100%',
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
          fontSize: 12,
          color: '#545b6b',
          boxSizing: 'border-box',
        }}>
          © 2025 BatchBridge.xyz — Multi-Chain Swap & Bridge · Non-custodial · Powered by LI.FI
        </footer>
      </div>
    </AppProvider>
  )
}
