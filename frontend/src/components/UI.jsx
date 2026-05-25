import { memo } from 'react'

export function Toast({ message }) {
  if (!message) return null
  return (
    <div className="toast" role="alert">
      <span className="toast-icon">i</span>
      <span>{message}</span>
    </div>
  )
}

export const LoaderIcon = memo(() => (
  <svg className="spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
))
LoaderIcon.displayName = 'LoaderIcon'

export const CheckIcon = memo(() => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
))
CheckIcon.displayName = 'CheckIcon'
