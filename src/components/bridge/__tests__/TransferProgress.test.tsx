import { afterEach, describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TransferProgress } from '../TransferProgress'
import type { TransferStep } from '../TransferProgress'

// vitest.config.ts sets `globals: false`, so @testing-library/react's
// automatic afterEach cleanup (which relies on a global `afterEach`) never
// registers - wire it up explicitly so each test starts with a fresh DOM.
afterEach(cleanup)

describe('TransferProgress', () => {
  it('renders all steps with the right status indicator per step', () => {
    const steps: TransferStep[] = [
      { label: 'Approve USDC', status: 'success' },
      { label: 'Bridge to Arbitrum', status: 'active' },
      { label: 'Confirm on destination', status: 'pending' },
      { label: 'Broken step', status: 'error' },
    ]
    render(<TransferProgress steps={steps} />)

    expect(screen.getByText('Approve USDC')).toBeInTheDocument()
    expect(screen.getByText('Bridge to Arbitrum')).toBeInTheDocument()
    expect(screen.getByText('Confirm on destination')).toBeInTheDocument()
    expect(screen.getByText('Broken step')).toBeInTheDocument()

    expect(screen.getByLabelText('success')).toBeInTheDocument()
    expect(screen.getByLabelText('active')).toBeInTheDocument()
    expect(screen.getByLabelText('pending')).toBeInTheDocument()
    expect(screen.getByLabelText('error')).toBeInTheDocument()
  })

  it('renders a step with explorerUrl as a link, and one without as plain text', () => {
    const steps: TransferStep[] = [
      { label: 'Bridge to Arbitrum', status: 'active', explorerUrl: 'https://arbiscan.io/tx/0xabc' },
      { label: 'Confirm on destination', status: 'pending' },
    ]
    render(<TransferProgress steps={steps} />)

    const link = screen.getByRole('link', { name: 'Bridge to Arbitrum' })
    expect(link).toHaveAttribute('href', 'https://arbiscan.io/tx/0xabc')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')

    expect(screen.queryByRole('link', { name: 'Confirm on destination' })).not.toBeInTheDocument()
    expect(screen.getByText('Confirm on destination')).toBeInTheDocument()
  })

  it('renders currentError when set, and nothing extra when absent', () => {
    const steps: TransferStep[] = [{ label: 'Bridge to Arbitrum', status: 'error' }]

    const { rerender } = render(<TransferProgress steps={steps} currentError="Bridge failed: insufficient liquidity" />)
    expect(screen.getByText('Bridge failed: insufficient liquidity')).toBeInTheDocument()

    rerender(<TransferProgress steps={steps} currentError={null} />)
    expect(screen.queryByText('Bridge failed: insufficient liquidity')).not.toBeInTheDocument()
  })
})
