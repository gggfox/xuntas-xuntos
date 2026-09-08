import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { formatDay } from '../../../convex/lib/cycleRules'
import { useDateFormats } from '../DateField/format'
import Pill from '../Pill'
import CommentThread from './CommentThread'

export type Entry = {
  _id: Id<'journalEntries'>
  athleteUserId: Id<'users'>
  kind: 'tournament' | 'training'
  title: string
  date: string
  body: string
  score?: string
  createdAt: number
  editedAt?: number
  commentCount: number
}

type Props = {
  entry: Entry
  /** The athlete, on their own alive journal. */
  canEdit: boolean
  onEdit?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
  /** Opens the thread on mount — the entry a notification pointed at. */
  focused?: boolean
  composerPrimary?: boolean
}

/**
 * One entry in the feed: what it was, when, how it went, and the words
 * under it. The thread loads only when opened — a feed of a hundred cards
 * must not ask for a hundred threads.
 */
export default function EntryCard({ entry, canEdit, onEdit, onDelete, focused = false, composerPrimary = false }: Props) {
  const [open, setOpen] = useState(focused)
  const fmt = useDateFormats()
  const locale = getLocale() as 'es' | 'en'
  const kind = entry.kind === 'tournament' ? m.journal_kind_tournament() : m.journal_kind_training()

  return (
    <article id={`entry-${entry._id}`} className={`card px-[21px] py-[19px] ${focused ? 'border-ink' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={entry.kind === 'tournament' ? 'ok' : 'neutral'}>{kind}</Pill>
        <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">{formatDay(entry.date, locale)}</span>
        {entry.score && <span className="font-mono text-[12px] tabular-nums">{entry.score}</span>}
      </div>
      <h3 className="mt-2 font-disp text-[17px] font-bold">{entry.title}</h3>
      <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed font-light whitespace-pre-wrap">{entry.body}</p>
      {entry.editedAt && (
        <p className="mt-2 font-mono text-[10.5px] tracking-[.06em] text-soft">
          {m.journal_edited({ when: fmt.full.format(new Date(entry.editedAt)) })}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {m.journal_comments_n({ n: entry.commentCount })}
        </button>
        {canEdit && onEdit && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(entry)}>
            {m.journal_edit()}
          </button>
        )}
        {canEdit && onDelete && entry.commentCount === 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm hover:border-bad hover:text-bad"
            onClick={() => onDelete(entry)}
          >
            {m.common_delete()}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <CommentThread athleteUserId={entry.athleteUserId} entryId={entry._id} composerPrimary={composerPrimary} />
        </div>
      )}
    </article>
  )
}
