import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import type { Id } from '../../convex/_generated/dataModel'
import AssignDialog from '../components/Admin/AssignDialog'
import InviteDialog from '../components/Admin/InviteDialog'
import NoTools from '../components/Admin/NoTools'
import StaffTable, { type StaffView } from '../components/Admin/StaffTable'
import Segmented, { segmentId } from '../components/Segmented'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'
import { describeConvexError } from '../lib/registrationErrors'

export const Route = createFileRoute('/administracion/equipo')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.admin_nav_staff() }) }] }),
  // Which of the two views is up, the way `registros` keeps its own in the
  // URL: a manager who has just sent an invitation and reloads should land
  // back on the invitations, not on the team.
  validateSearch: (s: Record<string, unknown>): { vista?: StaffView } =>
    s.vista === 'people' || s.vista === 'invites' ? { vista: s.vista } : {},
  component: StaffPage,
})

const PANEL_ID = 'equipo-panel'

function StaffPage() {
  const me = useMe()
  const list = useQuery(api.staff.list, me && can(me.roles, 'view_staff') ? {} : 'skip')
  const invite = useMutation(api.staff.invite)
  const setRoles = useMutation(api.staff.setRoles)
  const resend = useMutation(api.staff.resendInvite)
  const revoke = useMutation(api.staff.revokeInvite)
  const { vista } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const view: StaffView = vista ?? 'people'
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  /** Which staff member's athlete list is open, if any. */
  const [assigning, setAssigning] = useState<Id<'users'> | null>(null)
  const canAssign = !!me && can(me.roles, 'manage_assignments')
  // Both lists load only while the dialog is up: the roster is not needed
  // to draw the table, and a closed dialog has nothing to fill in.
  const members = useQuery(api.assignments.membersForPicker, canAssign && assigning ? {} : 'skip')
  const assigned = useQuery(api.assignments.forStaff, canAssign && assigning ? { staffUserId: assigning } : 'skip')
  const setForStaff = useMutation(api.assignments.setForStaff)

  if (!me) return null
  if (!can(me.roles, 'view_staff')) return <NoTools />
  if (list === undefined) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  const canManage = can(me.roles, 'manage_users')
  const assigningRow = assigning ? list.staff.find((s) => s._id === assigning) : undefined

  /** Every mutation surfaces its code here; the table itself stays dumb. */
  async function guard(run: () => Promise<unknown>) {
    setError(null)
    try {
      await run()
    } catch (err) {
      setError(describeConvexError(err))
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          name="equipo"
          label={m.staff_views()}
          value={view}
          panelId={PANEL_ID}
          items={[
            { id: 'people', label: m.staff_people_title() },
            { id: 'invites', label: m.staff_invites_title() },
          ]}
          onChange={(v) => void navigate({ search: { vista: v }, replace: true })}
        />
        {canManage && (
          <button type="button" className="btn btn-sm" onClick={() => setInviting(true)}>
            {m.staff_invite_title()}
          </button>
        )}
      </div>

      {note && <p className="mt-3 text-[12.5px] text-soft">{note}</p>}
      {error && <p className="mt-3 text-[12.5px] text-bad">{error}</p>}

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={segmentId('equipo', view)}>
        <StaffTable
          view={view}
          staff={list.staff}
          invites={list.invites}
          canManage={canManage}
          meId={list.staff.find((s) => s.email === me.email)?._id}
          onSetRoles={(userId, roles) => guard(() => setRoles({ userId, roles }))}
          onResend={(inviteId) => guard(() => resend({ inviteId }))}
          onRevoke={(inviteId) => guard(() => revoke({ inviteId }))}
          onAssign={canAssign ? (userId) => setAssigning(userId) : undefined}
        />
      </div>

      {assigningRow && members !== undefined && assigned !== undefined && (
        <AssignDialog
          staffName={assigningRow.name ?? assigningRow.email}
          members={members}
          current={assigned.map((a) => a._id)}
          onSave={(athleteUserIds) =>
            setForStaff({ staffUserId: assigningRow._id, athleteUserIds: athleteUserIds as Id<'users'>[] })
          }
          onClose={() => setAssigning(null)}
        />
      )}

      {inviting && (
        <InviteDialog
          onInvite={(input) => invite(input)}
          // An invitation lands in the other view, so the screen goes there
          // to show it rather than leaving the manager to wonder where it
          // went. A granted role lands in this one, and the note says which
          // of the two happened.
          onDone={(text) => {
            setNote(text)
            void navigate({ search: { vista: 'invites' }, replace: true })
          }}
          onClose={() => setInviting(false)}
        />
      )}
    </>
  )
}
