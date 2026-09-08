import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import DecisionPanel from '../../src/components/Admin/DecisionPanel'

const REVIEWER = ['review_registrations', 'send_rejection', 'view_staff'] as const
const ADMIN = [...REVIEWER, 'view_all_athletes', 'comment_journal', 'manage_assignments', 'remove_athletes'] as const
const MASTER = [
  ...ADMIN, 'select_registrations', 'send_batch', 'manage_users', 'manage_cycles', 'view_assigned_athletes',
] as const

function renderPanel(over: Partial<Parameters<typeof DecisionPanel>[0]> = {}) {
  const onDecide = vi.fn(async () => {})
  const onSendRejection = vi.fn(async () => {})
  render(
    <DecisionPanel
      status="submitted"
      guardianConfirmed
      notice={null}
      permissions={[...REVIEWER]}
      log={[]}
      onDecide={onDecide}
      onSendRejection={onSendRejection}
      {...over}
    />,
  )
  return { onDecide, onSendRejection }
}

describe('DecisionPanel', () => {
  it('offers validate and reject to a reviewer on a submitted registration, not select', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: m.detail_validate() })).toBeEnabled()
    expect(screen.getByRole('button', { name: m.detail_reject() })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.detail_select() })).not.toBeInTheDocument()
  })

  it('refuses to reject without a note, from the same rules the server runs', () => {
    const { onDecide } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: m.detail_reject() }))
    expect(onDecide).not.toHaveBeenCalled()
    expect(screen.getByText(m.err_note_required())).toBeInTheDocument()
  })

  it('offers select to a master admin on a validated registration', () => {
    const { onDecide } = renderPanel({ status: 'validated', permissions: [...MASTER] })
    fireEvent.click(screen.getByRole('button', { name: m.detail_select() }))
    expect(onDecide).toHaveBeenCalledWith('selected', '')
  })

  it('offers the rejection email only while the notice is pending', () => {
    const { onSendRejection } = renderPanel({ status: 'rejected', notice: 'not_sent' })
    fireEvent.click(screen.getByRole('button', { name: m.detail_send_rejection() }))
    fireEvent.click(screen.getByRole('button', { name: m.detail_send_rejection_confirm() }))
    expect(onSendRejection).toHaveBeenCalled()
    renderPanel({ status: 'rejected', notice: 'sent' })
    expect(screen.getAllByRole('button', { name: m.detail_send_rejection() })).toHaveLength(1)
  })

  /**
   * The rejection email cannot be recalled, so one click must never be
   * enough — the batch send gets a modal for the same reason. The first
   * click only arms the button (its label switches to the confirm text);
   * only a second click, while still armed, actually sends.
   */
  it('requires a second press to send the rejection email', () => {
    const { onSendRejection } = renderPanel({ status: 'rejected', notice: 'not_sent' })
    fireEvent.click(screen.getByRole('button', { name: m.detail_send_rejection() }))
    expect(onSendRejection).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: m.detail_send_rejection_confirm() })).toBeInTheDocument()
  })

  it('disarms the confirm state when the button loses focus', () => {
    const { onSendRejection } = renderPanel({ status: 'rejected', notice: 'not_sent' })
    const button = screen.getByRole('button', { name: m.detail_send_rejection() })
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: m.detail_send_rejection_confirm() })).toBeInTheDocument()
    fireEvent.blur(screen.getByRole('button', { name: m.detail_send_rejection_confirm() }))
    expect(screen.getByRole('button', { name: m.detail_send_rejection() })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.detail_send_rejection() }))
    expect(onSendRejection).not.toHaveBeenCalled()
  })

  /** Removal is administration's own act: a plain admin gets the button on a member, and on a removed row the one way back reads "Reincorporar". */
  it('offers removal to an admin on a selected member, and reinstatement on a removed one', () => {
    const { onDecide } = renderPanel({ status: 'selected', notice: 'delivered', permissions: [...ADMIN] })
    const remove = screen.getByRole('button', { name: m.detail_remove() })
    // The only move an admin has on a delivered selection, so it takes the
    // screen's yellow — and keeps the destructive hover either way.
    expect(remove.className).toContain('hover:border-bad')
    expect(screen.queryByRole('button', { name: m.detail_not_select() })).not.toBeInTheDocument()
    fireEvent.click(remove)
    expect(onDecide).not.toHaveBeenCalled()
    expect(screen.getByText(m.err_note_required())).toBeInTheDocument()
  })

  it('keeps removal ghost behind the Council\'s own moves for a master admin', () => {
    renderPanel({ status: 'selected', permissions: [...MASTER] })
    expect(screen.getByRole('button', { name: m.detail_remove() }).className).toContain('btn-ghost')
  })

  it('offers only reinstatement on a removed row, and never to a plain reviewer', () => {
    renderPanel({ status: 'removed', permissions: [...ADMIN] })
    expect(screen.getByRole('button', { name: m.detail_reinstate() })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.detail_select() })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.detail_validate() })).not.toBeInTheDocument()
    renderPanel({ status: 'removed', permissions: [...REVIEWER] })
    expect(screen.getAllByRole('button', { name: m.detail_reinstate() })).toHaveLength(1)
  })

  it('never shows two solid-yellow buttons at once, even when a master admin can both re-validate and re-select a not_selected registration', () => {
    renderPanel({ status: 'not_selected', permissions: [...MASTER] })
    const solid = screen.getAllByRole('button').filter((el) => {
      const classes = el.className.split(/\s+/)
      return classes.includes('btn') && !classes.includes('btn-ghost')
    })
    expect(solid).toHaveLength(1)
  })
})
