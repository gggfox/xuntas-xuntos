import { useMutation, useQuery } from 'convex/react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'
import { COMMENT_LIMIT, validateComment } from '../../../convex/lib/journalRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'
import Pill from '../Pill'
import { roleName } from '../Admin/RoleChecks'
import { useDateFormats } from '../DateField/format'
import type { Role } from '../../lib/permissions'

type Props = {
  athleteUserId: Id<'users'>
  /** Absent for the athlete's general stream. */
  entryId?: Id<'journalEntries'>
  /** Whether the composer's button is the screen's solid yellow. One per screen. */
  composerPrimary?: boolean
}

/**
 * One thread, newest first, and the box to add to it. The server says
 * whether this reader may write (`canComment`), so the composer appears
 * only where a comment would be accepted — a removed member's frozen
 * journal shows the words and no box.
 */
export default function CommentThread({ athleteUserId, entryId, composerPrimary = false }: Props) {
  const thread = useQuery(api.journal.comments, { athleteUserId, entryId })
  const add = useMutation(api.journal.addComment)
  const remove = useMutation(api.journal.deleteComment)
  const fmt = useDateFormats()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const boxId = useId()

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const problem = validateComment(body)
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await add({ athleteUserId, entryId, body: body.trim() })
      setBody('')
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  if (thread === undefined) return <p className="text-[12.5px] text-soft">{m.common_loading()}</p>

  return (
    <div className="grid gap-3">
      {thread.canComment && (
        <form onSubmit={submit} noValidate className="grid gap-1.5">
          <label htmlFor={boxId} className="sr-only">
            {m.journal_comment_label()}
          </label>
          <textarea
            id={boxId}
            className="fld-input min-h-[72px] resize-y"
            value={body}
            maxLength={COMMENT_LIMIT}
            placeholder={m.journal_comment_placeholder()}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={composerPrimary ? 'btn btn-sm' : 'btn btn-ghost btn-sm'} disabled={busy}>
              {busy ? m.common_loading() : m.journal_comment_send()}
            </button>
            <span className="font-mono text-[11px] text-soft">
              {m.reg_letter_counter({ count: body.length, limit: COMMENT_LIMIT })}
            </span>
            {error && <span className="text-[11.5px] text-bad">{error}</span>}
          </div>
        </form>
      )}

      {thread.comments.length === 0 ? (
        <p className="text-[12.5px] font-light text-soft">{m.journal_no_comments()}</p>
      ) : (
        <ul className="grid list-none gap-3 p-0">
          {thread.comments.map((c) => (
            <li key={c._id} className="border-l-2 border-line pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-[13px] font-semibold">{c.authorName || m.detail_empty()}</b>
                {c.isAthlete ? (
                  <Pill>{m.journal_role_athlete()}</Pill>
                ) : (
                  c.authorRoles.map((r) => <Pill key={r}>{roleName(r as Role)}</Pill>)
                )}
                <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">
                  {fmt.full.format(new Date(c.createdAt))}
                </span>
                {c.isMine && (
                  <button
                    type="button"
                    className="ml-auto font-mono text-[10.5px] tracking-[.06em] text-soft hover:text-bad"
                    onClick={() => void remove({ id: c._id }).catch((err) => setError(describeConvexError(err)))}
                  >
                    {m.common_delete()}
                  </button>
                )}
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed font-light whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
