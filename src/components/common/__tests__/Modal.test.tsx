import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Modal } from '../Modal'

afterEach(cleanup)

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}}>
        content
      </Modal>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders content and title when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Select token">
        <p>Body content</p>
      </Modal>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Select token')).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Settings">
        <p>Body</p>
      </Modal>
    )
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking inside the card', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Settings">
        <p>Body content</p>
      </Modal>
    )
    fireEvent.click(screen.getByText('Body content'))
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Settings">
        <p>Body</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus: Tab from the last focusable element cycles back to the first', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Settings">
        <button>First</button>
        <button>Second</button>
      </Modal>
    )

    const closeButton = screen.getByRole('button', { name: 'Close' })
    const secondButton = screen.getByRole('button', { name: 'Second' })

    secondButton.focus()
    expect(document.activeElement).toBe(secondButton)

    fireEvent.keyDown(secondButton, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)
  })

  it('traps focus: Shift+Tab from the first focusable element cycles to the last', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Settings">
        <button>First</button>
        <button>Second</button>
      </Modal>
    )

    const closeButton = screen.getByRole('button', { name: 'Close' })
    const secondButton = screen.getByRole('button', { name: 'Second' })

    closeButton.focus()
    expect(document.activeElement).toBe(closeButton)

    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(secondButton)
  })

  it('returns focus to the trigger element after closing', () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(false)
      return (
        <div>
          <button onClick={() => setIsOpen(true)}>Open modal</button>
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Settings">
            <button>Inside</button>
          </Modal>
        </div>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open modal' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })
})
