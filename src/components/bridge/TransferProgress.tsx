import React from 'react'

export type TransferStepStatus = 'pending' | 'active' | 'success' | 'error'

export interface TransferStep {
  label: string // e.g. "Approve USDC", "Bridge to Arbitrum", "Confirm on destination"
  status: TransferStepStatus
  explorerUrl?: string // link to view this step's tx on a block explorer, once it has a hash
}

export interface TransferProgressProps {
  steps: TransferStep[]
  currentError?: string | null
}

const StatusIndicator: React.FC<{ status: TransferStepStatus }> = ({ status }) => {
  if (status === 'success') {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--pos)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="success"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    )
  }

  if (status === 'active') {
    return (
      <span
        role="status"
        aria-label="active"
        className="h-[18px] w-[18px] rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin motion-reduce:animate-none"
      />
    )
  }

  if (status === 'error') {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--neg)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="error"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
    )
  }

  return (
    <span
      aria-label="pending"
      className="h-[18px] w-[18px] rounded-full border-2 border-[var(--ink-3)]"
    />
  )
}

/**
 * Step-by-step progress for an in-flight cross-chain transfer. Generic over
 * `steps`/`currentError` so both Bridge mode and (later) Batch mode's
 * BatchCard can render the same UI for their own step lists.
 */
export const TransferProgress: React.FC<TransferProgressProps> = ({ steps, currentError }) => {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={index} className="flex items-center gap-3">
            <StatusIndicator status={step.status} />
            {step.explorerUrl ? (
              <a
                href={step.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[var(--ink)] underline hover:text-[var(--accent)]"
              >
                {step.label}
              </a>
            ) : (
              <span className="text-sm text-[var(--ink)]">{step.label}</span>
            )}
          </li>
        ))}
      </ul>

      {currentError && <p className="text-sm text-[var(--neg)]">{currentError}</p>}
    </div>
  )
}
