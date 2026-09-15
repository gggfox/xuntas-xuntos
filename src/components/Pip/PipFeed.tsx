import { usePaginatedQuery, useQuery } from 'convex/react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { POST_KINDS, monthKeyOf, type PostKind } from '../../../convex/lib/pipRules'
import PostCard, { kindLabel } from './PostCard'

const PAGE = 12

/** "septiembre 2026", from a `YYYY-MM` key, in the reader's locale. */
export function monthTitle(key: string): string {
  const [y, mo] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(getLocale() === 'en' ? 'en' : 'es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, mo - 1, 15)))
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

type Props = {
  /** The post a notification pointed at: opened, the others folded. */
  focusPostId?: string
}

/**
 * The member's feed. A month select and kind chips ask the server for a
 * slice; the list groups what comes back under month headers, newest
 * first. Cards fold and unfold independently; the newest one — or the one
 * a notification pointed at — starts open.
 */
export default function PipFeed({ focusPostId }: Props) {
  const [month, setMonth] = useState<string>('all')
  const [kind, setKind] = useState<'all' | PostKind>('all')
  const [openIds, setOpenIds] = useState<Set<string> | null>(null)
  const monthId = useId()
  const months = useQuery(api.pip.months) ?? []
  const args: { month?: string; kind?: PostKind } = {}
  if (month !== 'all') args.month = month
  if (kind !== 'all') args.kind = kind
  const { results, status, loadMore } = usePaginatedQuery(api.pip.feed, args, { initialNumItems: PAGE })

  // Until the reader touches a card, "open" means the newest post, or the
  // one the notification named. After that, it is whatever they left open.
  const open = openIds ?? new Set(focusPostId ? [focusPostId] : results[0] ? [results[0]._id] : [])
  const toggle = (id: string) =>
    setOpenIds((s) => {
      const next = new Set(s ?? open)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-2.5">
        <label htmlFor={monthId} className="sr-only">{m.pip_month_label()}</label>
        <select id={monthId} className="fld-input h-[34px] w-auto py-0 pr-8 text-[13px]" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">{m.pip_months_all()}</option>
          {months.map((x) => (
            <option key={x.key} value={x.key}>{cap(monthTitle(x.key))} · {x.count}</option>
          ))}
        </select>
        <div className="flex gap-1.5 overflow-x-auto">
          <button type="button" className="chip chip-toggle flex-none" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{m.pip_kind_all()}</button>
          {POST_KINDS.map((k) => (
            <button key={k} type="button" className="chip chip-toggle flex-none" aria-pressed={kind === k} onClick={() => setKind(k)}>{kindLabel(k)}</button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {status === 'LoadingFirstPage' && <p className="text-soft">{m.common_loading()}</p>}
        {status !== 'LoadingFirstPage' && results.length === 0 && (
          <p className="text-soft">{month === 'all' && kind === 'all' ? m.pip_empty() : m.pip_no_match()}</p>
        )}
        {results.map((p, i) => {
          const prev = results[i - 1]
          const key = monthKeyOf(p.publishedAt)
          const newMonth = month === 'all' && (!prev || monthKeyOf(prev.publishedAt) !== key)
          return (
            <div key={p._id} className="grid gap-3">
              {newMonth && (
                <h2 className="mt-3 flex items-center gap-4 font-mono text-[11px] tracking-[.14em] uppercase text-soft first:mt-0">
                  {monthTitle(key)}
                  <span aria-hidden="true" className="h-px flex-1 bg-line" />
                </h2>
              )}
              <PostCard post={p} open={open.has(p._id)} onToggle={() => toggle(p._id)} />
            </div>
          )
        })}
        {status === 'CanLoadMore' && (
          <button type="button" className="btn btn-ghost justify-self-center" onClick={() => loadMore(PAGE)}>{m.pip_load_more()}</button>
        )}
      </div>
    </>
  )
}
