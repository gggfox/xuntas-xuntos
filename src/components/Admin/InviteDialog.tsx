import { useId, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import RoleChecks from './RoleChecks'
import type { Role } from '../../lib/permissions'
import { validateInvite } from '../../../convex/lib/staffRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'
import { useModal } from '../../hooks/useModal'

type Props = {
  onInvite: (input: { email: string; roles: Role[] }) => Promise<{ kind: 'invited' | 'granted' }>
  /** What to say on the page once the dialog has closed itself. */
  onDone: (note: string) => void
  onClose: () => void
}

/**
 * Inviting someone, as a dialog rather than a panel.
 *
 * It used to stand open above the tables, which put the rarest thing on the
 * screen at the top of it: a season adds two or three people to the team and
 * then nobody touches this form again, while the tables under it are read
 * every week. A card that size, permanently, is the screen telling the
 * reader the wrong thing about what it is for.
 *
 * Native `<dialog>`, the same as `BatchSendDialog`, so focus and Escape are
 * the browser's rather than ours. The confirmation is handed up and printed
 * on the page instead of shown in here, because the dialog closes on
 * success — a message inside it would close along with it.
 */
export default function InviteDialog({ onInvite, onDone, onClose }: Props) {
  const { close, dialogProps } = useModal(onClose)
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // `showModal` gives the dialog no accessible name of its own.
  const titleId = useId()


  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const problem = validateInvite({ email, roles })
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      const r = await onInvite({ email: email.trim().toLowerCase(), roles })
      onDone(r.kind === 'invited' ? m.staff_invited() : m.staff_granted())
      close()
    } catch (err) {
      // Reported in here, not on the page: the page is behind an inert
      // backdrop while this is open, so a message printed out there is one
      // the reader cannot see or reach.
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className="card m-auto w-[min(46ch,calc(100vw-32px))] px-[21px] py-[19px]"
    >
      <form onSubmit={submit} noValidate>
        <b id={titleId} className="block font-disp text-[16px]">
          {m.staff_invite_title()}
        </b>
        <label htmlFor="invite-email" className="mt-4 block text-[12.5px] font-medium">
          {m.staff_invite_email()} <span className="text-bad">*</span>
        </label>
        <input
          id="invite-email"
          type="email"
          className="fld-input mt-1.5 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          // The dialog exists to be filled in, and the browser puts the
          // focus on the first focusable child otherwise — which is fine,
          // but this says which one deliberately.
          autoFocus
        />
        <p className="mb-1.5 text-[12.5px] font-medium">{m.staff_invite_roles()}</p>
        <RoleChecks idPrefix="invite" label={m.staff_invite_roles()} value={roles} onChange={setRoles} />
        <p className="mt-2 min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? m.common_loading() : m.staff_invite_send()}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => close()}>
            {m.staff_cancel()}
          </button>
        </div>
      </form>
    </dialog>
  )
}
