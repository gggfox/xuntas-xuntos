import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import DecisionPanel from '../../src/components/Admin/DecisionPanel'

const REVIEWER = ['review_registrations', 'send_rejection', 'view_staff'] as const
const MASTER = [...REVIEWER, 'select_registrations', 'send_batch', 'manage_users', 'manage_cycles'] as const

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

  it('never shows two solid-yellow buttons at once, even when a master admin can both re-validate and re-select a not_selected registration', () => {
    renderPanel({ status: 'not_selected', permissions: [...MASTER] })
    const solid = screen.getAllByRole('button').filter((el) => {
      const classes = el.className.split(/\s+/)
      return classes.includes('btn') && !classes.includes('btn-ghost')
    })
    expect(solid).toHaveLength(1)
  })
})
