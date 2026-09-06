import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BatchSendDialog from '../../src/components/Admin/BatchSendDialog'

/**
 * The send itself is covered through the registrations route and the notice
 * rules. What is asserted here is only that this dialog carries the same
 * dismissal as the other two — the behaviour lives in `useModal` and is
 * exercised in full by `RegistrationFilters`.
 */
describe('BatchSendDialog', () => {
  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <BatchSendDialog
        count={3}
        windowOpen={false}
        onConfirm={async () => ({ scheduled: 3, skipped: 0 })}
        onTest={async () => {}}
        onClose={onClose}
      />,
    )
    const dialog = screen.getByRole('dialog')
    // jsdom lays nothing out, so the dialog is given a box for the click to
    // fall outside of.
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      top: 200, left: 100, right: 400, bottom: 500, width: 300, height: 300, x: 100, y: 200, toJSON: () => ({}),
    } as DOMRect)

    fireEvent.mouseDown(dialog, { clientX: 20, clientY: 20 })
    fireEvent.click(dialog, { clientX: 20, clientY: 20 })
    expect(onClose).toHaveBeenCalled()
  })
})
