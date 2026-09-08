import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import StaffTable, { type StaffView } from '../../src/components/Admin/StaffTable'
import type { Id } from '../../convex/_generated/dataModel'

const staff = [
  { _id: 'u1' as Id<'users'>, name: 'Gerardo', email: 'g@xuntas.org', roles: ['master_admin'] as const },
  { _id: 'u2' as Id<'users'>, name: 'Ana', email: 'ana@xuntas.org', roles: ['admin'] as const },
  { _id: 'u3' as Id<'users'>, name: 'Luisa', email: 'luisa@xuntas.org', roles: ['coach'] as const },
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

function renderTable(canManage: boolean, view: StaffView = 'people', onAssign?: (id: Id<'users'>) => void) {
  const onSetRoles = vi.fn(async () => {})
  const onResend = vi.fn(async () => {})
  const onRevoke = vi.fn(async () => {})
  render(
    <StaffTable
      view={view}
      staff={[...staff]}
      invites={[...invites]}
      canManage={canManage}
      meId={'u1' as Id<'users'>}
      onSetRoles={onSetRoles}
      onResend={onResend}
      onRevoke={onRevoke}
      onAssign={onAssign}
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

  /**
   * The two tables are alternatives now, not a stack: the page shows one at
   * a time and the segmented control picks which. A view that leaked the
   * other one's rows would put the invitations back under the team.
   */
  it('draws only the view it was given', () => {
    renderTable(false, 'people')
    expect(screen.queryByText('luis@xuntas.org')).not.toBeInTheDocument()
    cleanup()
    renderTable(false, 'invites')
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByText('luis@xuntas.org')).toBeInTheDocument()
  })

  it('offers no edit controls without manage_users', () => {
    renderTable(false)
    expect(screen.queryByRole('button', { name: m.staff_edit() })).not.toBeInTheDocument()
  })

  /** Administration sees every member already; only a coach or a health specialist has a list to fill. */
  it('offers the athlete picker on assignable rows only, and only when given a handler', () => {
    const onAssign = vi.fn()
    renderTable(false, 'people', onAssign)
    const buttons = screen.getAllByRole('button', { name: m.staff_assign() })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    expect(onAssign).toHaveBeenCalledWith('u3')
    cleanup()
    renderTable(true)
    expect(screen.queryByRole('button', { name: m.staff_assign() })).not.toBeInTheDocument()
  })

  it('offers no invitation controls without manage_users', () => {
    renderTable(false, 'invites')
    expect(screen.queryByRole('button', { name: m.staff_resend() })).not.toBeInTheDocument()
  })

  it('saves an edited set of roles', () => {
    const { onSetRoles } = renderTable(true)
    fireEvent.click(screen.getAllByRole('button', { name: m.staff_edit() })[1])
    fireEvent.click(screen.getByRole('button', { name: m.role_coach() }))
    fireEvent.click(screen.getByRole('button', { name: m.staff_save() }))
    expect(onSetRoles).toHaveBeenCalledWith('u2', ['admin', 'coach'])
  })

  /**
   * The roles are toggles, not labels: a screen reader has to be told which
   * of the five are on, and pressing one has to turn it off again. Reading
   * `aria-pressed` is what separates a switch from a button that happens to
   * look chosen.
   */
  it('reports each role as a switch and toggles it off again', () => {
    const { onSetRoles } = renderTable(true)
    fireEvent.click(screen.getAllByRole('button', { name: m.staff_edit() })[1])

    const admin = screen.getByRole('button', { name: m.role_admin() })
    const coach = screen.getByRole('button', { name: m.role_coach() })
    expect(admin).toHaveAttribute('aria-pressed', 'true')
    expect(coach).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(admin)
    fireEvent.click(screen.getByRole('button', { name: m.staff_save() }))
    expect(onSetRoles).toHaveBeenCalledWith('u2', [])
  })

  it('lists invitations with their status and lets a manager resend or revoke', () => {
    const { onResend, onRevoke } = renderTable(true, 'invites')
    expect(screen.getByText('luis@xuntas.org')).toBeInTheDocument()
    expect(screen.getByText(m.invite_status_pending())).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.staff_resend() }))
    expect(onResend).toHaveBeenCalledWith('i1')
    fireEvent.click(screen.getByRole('button', { name: m.staff_revoke() }))
    expect(onRevoke).toHaveBeenCalledWith('i1')
  })

  it('says the two empty states apart', () => {
    render(
      <StaffTable
        view="invites"
        staff={[]}
        invites={[]}
        canManage
        meId={undefined}
        onSetRoles={async () => {}}
        onResend={async () => {}}
        onRevoke={async () => {}}
      />,
    )
    expect(screen.getByText(m.staff_invites_none())).toBeInTheDocument()
    expect(screen.queryByText(m.staff_none())).not.toBeInTheDocument()
  })
})
