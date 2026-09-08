import { useId, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import Pill from '../Pill'
import { describeConvexError } from '../../lib/registrationErrors'
import { useModal } from '../../hooks/useModal'

export type Member = { _id: string; name: string; branch: 'womens' | 'mens' }

type Props = {
  /** Whose list this is. */
  staffName: string
  /** Every current member, in the order to list them. */
  members: Member[]
  /** The ids already assigned to this staff member. */
  current: readonly string[]
  onSave: (athleteUserIds: string[]) => Promise<unknown>
  onClose: () => void
}

/**
 * The checkbox list behind "Atletas" on a staff row. A whole list is saved,
 * not one toggle at a time: the manager reads the roster, ticks who this
 * coach works with, and presses once. Same dialog skeleton as
 * `InviteDialog`, same reasons.
 */
export default function AssignDialog({ staffName, members, current, onSave, onClose }: Props) {
  const { close, dialogProps } = useModal(onClose)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(current))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const titleId = useId()
  const listId = useId()

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onSave(members.filter((mb) => picked.has(mb._id)).map((mb) => mb._id))
      close()
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className="card m-auto w-[min(52ch,calc(100vw-32px))] px-[21px] py-[19px]"
    >
      <form onSubmit={submit} noValidate>
        <b id={titleId} className="block font-disp text-[16px]">
          {m.assign_title({ name: staffName })}
        </b>
        <p className="mt-1 text-[12.5px] font-light text-soft">{m.assign_help()}</p>

        {members.length === 0 ? (
          <p className="mt-4 text-[13px] text-soft">{m.assign_none()}</p>
        ) : (
          <ul id={listId} className="mt-4 grid max-h-[50vh] list-none gap-1 overflow-y-auto p-0">
            {members.map((mb) => {
              const id = `${listId}-${mb._id}`
              return (
                <li key={mb._id} className="flex items-center gap-3 rounded-ctl px-2 py-1.5 hover:bg-wash">
                  <input
                    id={id}
                    type="checkbox"
                    checked={picked.has(mb._id)}
                    onChange={() => toggle(mb._id)}
                  />
                  <label htmlFor={id} className="flex flex-1 items-center justify-between gap-3 text-[13.5px]">
                    <span>{mb.name}</span>
                    <Pill>{mb.branch === 'womens' ? m.reg_branch_womens() : m.reg_branch_mens()}</Pill>
                  </label>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-2 min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? m.common_loading() : m.assign_save()}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => close()}>
            {m.staff_cancel()}
          </button>
          <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
            {m.assign_count({ n: picked.size })}
          </span>
        </div>
      </form>
    </dialog>
  )
}
