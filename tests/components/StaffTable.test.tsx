import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import StaffTable from '../../src/components/Admin/StaffTable'
import type { Id } from '../../convex/_generated/dataModel'

const staff = [
  { _id: 'u1' as Id<'users'>, name: 'Gerardo', email: 'g@xuntas.org', roles: ['master_admin'] as const },
  { _id: 'u2' as Id<'users'>, name: 'Ana', email: 'ana@xuntas.org', roles: ['admin'] as const },
]
const invites = [
  {
    _id: 'i1' as Id<'staffInvites'>,
    email: 'luis@xuntas.org',
    roles: ['coach'] as const,
    status: 'pending' as const,
    expiresAt: Date.parse('2026-09-10T00:00:00Z'),
    lastSentAt: 0,
    invitedByName: 'Gerardo',
  },
]

function renderTable(canManage: boolean) {
  const onSetRoles = vi.fn(async () => {})
  const onResend = vi.fn(async () => {})
  const onRevoke = vi.fn(async () => {})
  render(
    <StaffTable
      staff={[...staff]}
      invites={[...invites]}
      canManage={canManage}
      meId={'u1' as Id<'users'>}
      onSetRoles={onSetRoles}
      onResend={onResend}
      onRevoke={onRevoke}
    />,
  )
  return { onSetRoles, onResend, onRevoke }
}

describe('StaffTable', () => {
  it('lists people with their role names and marks the reader', () => {
    renderTable(false)
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText(m.role_admin())).toBeInTheDocument()
    expect(screen.getByText(new RegExp(m.staff_you()))).toBeInTheDocument()
  })

  it('offers no edit controls without manage_users', () => {
    renderTable(false)
    expect(screen.queryByRole('button', { name: m.staff_edit() })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.staff_resend() })).not.toBeInTheDocument()
  })

  it('saves an edited set of roles', () => {
    const { onSetRoles } = renderTable(true)
    fireEvent.click(screen.getAllByRole('button', { name: m.staff_edit() })[1])
    fireEvent.click(screen.getByLabelText(m.role_coach()))
    fireEvent.click(screen.getByRole('button', { name: m.staff_save() }))
    expect(onSetRoles).toHaveBeenCalledWith('u2', ['admin', 'coach'])
  })

  it('lists invitations with their status and lets a manager resend or revoke', () => {
    const { onResend, onRevoke } = renderTable(true)
    expect(screen.getByText('luis@xuntas.org')).toBeInTheDocument()
    expect(screen.getByText(m.invite_status_pending())).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.staff_resend() }))
    expect(onResend).toHaveBeenCalledWith('i1')
    fireEvent.click(screen.getByRole('button', { name: m.staff_revoke() }))
    expect(onRevoke).toHaveBeenCalledWith('i1')
  })
})
