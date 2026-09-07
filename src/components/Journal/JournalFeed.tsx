import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'
import { todayISO } from '../../../convex/lib/journalRules'
import { describeConvexError } from '../../lib/registrationErrors'
import RangeField from '../DateField/RangeField'
import EntryCard, { type Entry } from './EntryCard'
import EntryDialog from './EntryDialog'

/** The first page is a season; the next ones, a month or two each. */
const FIRST_PAGE = 100
const NEXT_PAGE = 50

type Props = {
  athleteUserId: Id<'users'>
  /** The athlete on their own alive journal: edit and delete appear. */
  canEdit: boolean
  /** An entry to bring to the top with its thread open — from a notification. */
  focusEntryId?: string
  /** Whether comment buttons here take the screen's one solid yellow. */
  composerPrimary?: boolean
}

/**
 * The feed: newest first, a hundred at a time, more as the reader nears
 * the end. The date range re-runs the query from the top rather than
 * filtering what is loaded — the point of a range is the entries the page
 * does not have yet.
 *
 * "Load more" is both a sentinel the scroll trips and a button: the button
 * is the one a keyboard, a screen reader, or a browser without observers
 * can reach.
 */
export default function JournalFeed({ athleteUserId, canEdit, focusEntryId, composerPrimary = false }: Props) {
  const [range, setRange] = useState({ start: '', end: '' })
  const [editing, setEditing] = useState<Entry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rangeId = useId()
  const today = todayISO()

  const { results, status, loadMore } = usePaginatedQuery(
    api.journal.entries,
    { athleteUserId, from: range.start || undefined, to: range.end || undefined },
    { initialNumItems: FIRST_PAGE },
  )
  const focused = useQuery(
    api.journal.entry,
    focusEntryId ? { id: focusEntryId as Id<'journalEntries'> } : 'skip',
  )
  const update = useMutation(api.journal.updateEntry)
  const remove = useMutation(api.journal.deleteEntry)

  const sentinel = useRef<HTMLDivElement>(null)
  const canLoad = status === 'CanLoadMore'
  useEffect(() => {
    // jsdom has no observers; the button below is the path there.
    if (!canLoad || typeof IntersectionObserver === 'undefined' || !sentinel.current) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore(NEXT_PAGE)
    })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [canLoad, loadMore])

  async function guard(run: () => Promise<unknown>) {
    setError(null)
    try {
      await run()
    } catch (err) {
      setError(describeConvexError(err))
    }
  }

  // The focused entry leads, once, whether or not the page holds it; the
  // rest of the feed skips it so it is not read twice.
  const list = results.filter((e) => e._id !== focusEntryId)
  const inRange = focused && (!range.start || focused.date >= range.start) && (!range.end || focused.date <= range.end)
  const hasRange = Boolean(range.start || range.end)

  return (
    <section className="grid gap-4">
      <details className="card px-[21px] py-[15px]">
        <summary className="cursor-pointer font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
          {hasRange ? m.journal_range_active() : m.journal_range_label()}
        </summary>
        <div className="mt-4">
          <RangeField
            id={rangeId}
            label={m.journal_range_label()}
            start={range.start}
            end={range.end}
            onChange={setRange}
            min="2000-01-01"
            max={today}
          />
          {hasRange && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRange({ start: '', end: '' })}>
              {m.journal_range_clear()}
            </button>
          )}
        </div>
      </details>

      {error && <p className="text-[12.5px] text-bad">{error}</p>}

      {focused && inRange && (
        <EntryCard
          entry={focused}
          canEdit={canEdit}
          onEdit={setEditing}
          onDelete={(e) => guard(() => remove({ id: e._id }))}
          focused
          composerPrimary={composerPrimary}
        />
      )}

      {status === 'LoadingFirstPage' ? (
        <p className="text-[12.5px] text-soft">{m.common_loading()}</p>
      ) : list.length === 0 && !focused ? (
        <p className="card px-[21px] py-[19px] text-[13.5px] font-light text-soft">
          {hasRange ? m.journal_empty_range() : m.journal_empty()}
        </p>
      ) : (
        list.map((e) => (
          <EntryCard
            key={e._id}
            entry={e}
            canEdit={canEdit}
            onEdit={setEditing}
            onDelete={(x) => guard(() => remove({ id: x._id }))}
            composerPrimary={composerPrimary}
          />
        ))
      )}

      <div ref={sentinel} aria-hidden="true" />
      {canLoad && (
        <button type="button" className="btn btn-ghost justify-self-center" onClick={() => loadMore(NEXT_PAGE)}>
          {m.journal_load_more()}
        </button>
      )}
      {status === 'LoadingMore' && <p className="text-center text-[12.5px] text-soft">{m.common_loading()}</p>}
      {status === 'Exhausted' && list.length > 0 && (
        <p className="text-center font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">{m.journal_end()}</p>
      )}

      {editing && (
        <EntryDialog
          initial={{ kind: editing.kind, title: editing.title, date: editing.date, body: editing.body, score: editing.score }}
          onSubmit={(input) => update({ id: editing._id, ...input })}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}
