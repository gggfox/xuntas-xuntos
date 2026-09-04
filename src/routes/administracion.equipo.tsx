import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import InviteForm from '../components/Admin/InviteForm'
import NoTools from '../components/Admin/NoTools'
import StaffTable from '../components/Admin/StaffTable'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'
import { describeConvexError } from '../lib/registrationErrors'

export const Route = createFileRoute('/administracion/equipo')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.admin_nav_staff() }) }] }),
  component: StaffPage,
})

function StaffPage() {
  const me = useMe()
  const list = useQuery(api.staff.list, me && can(me.roles, 'view_staff') ? {} : 'skip')
  const invite = useMutation(api.staff.invite)
  const setRoles = useMutation(api.staff.setRoles)
  const resend = useMutation(api.staff.resendInvite)
  const revoke = useMutation(api.staff.revokeInvite)
  const [error, setError] = useState<string | null>(null)

  if (!me) return null
  if (!can(me.roles, 'view_staff')) return <NoTools />
  if (list === undefined) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  const canManage = can(me.roles, 'manage_users')

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
      {canManage && <InviteForm onInvite={(input) => invite(input)} />}
      {error && <p className="mt-4 text-[12.5px] text-bad">{error}</p>}
      <StaffTable
        staff={list.staff}
        invites={list.invites}
        canManage={canManage}
        meId={list.staff.find((s) => s.email === me.email)?._id}
        onSetRoles={(userId, roles) => guard(() => setRoles({ userId, roles }))}
        onResend={(inviteId) => guard(() => resend({ inviteId }))}
        onRevoke={(inviteId) => guard(() => revoke({ inviteId }))}
      />
    </>
  )
}
