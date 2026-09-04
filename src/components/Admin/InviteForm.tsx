import { useState } from 'react'
import * as m from '../../paraglide/messages.js'
import RoleChecks from './RoleChecks'
import type { Role } from '../../lib/permissions'
import { validateInvite } from '../../../convex/lib/staffRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'

type Props = {
  onInvite: (input: { email: string; roles: Role[] }) => Promise<{ kind: 'invited' | 'granted' }>
}

export default function InviteForm({ onInvite }: Props) {
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setDone(null)
    const problem = validateInvite({ email, roles })
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      const r = await onInvite({ email: email.trim().toLowerCase(), roles })
      setDone(r.kind === 'invited' ? m.staff_invited() : m.staff_granted())
      setEmail('')
      setRoles([])
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card mt-8 max-w-[62ch] px-[21px] py-[19px]">
      <b className="mb-3 block font-disp text-[15px]">{m.staff_invite_title()}</b>
      <label htmlFor="invite-email" className="text-[12.5px] font-medium">
        {m.staff_invite_email()} <span className="text-bad">*</span>
      </label>
      <input
        id="invite-email"
        type="email"
        className="fld-input mt-1.5 mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="off"
      />
      <p className="mb-1.5 text-[12.5px] font-medium">{m.staff_invite_roles()}</p>
      <RoleChecks idPrefix="invite" value={roles} onChange={setRoles} />
      <p className="mt-2 min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? m.common_loading() : m.staff_invite_send()}
        </button>
        {done && <span className="text-[12.5px] text-soft">{done}</span>}
      </div>
    </form>
  )
}
