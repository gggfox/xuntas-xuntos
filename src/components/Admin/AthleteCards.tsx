import { useMemo } from 'react'
import * as m from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { formatDay } from '../../../convex/lib/cycleRules'
import type { AthleteRow } from './AthletesTable'

type Props = {
  rows: AthleteRow[]
  onOpen: (id: string) => void
}

/**
 * The members, below `md`, where the table cannot go. Same reasoning as
 * `RegistrationCards`: the whole card is the target, and the row's
 * columns become one mono line under the name.
 */
export default function AthleteCards({ rows, onOpen }: Props) {
  const locale = getLocale() as 'es' | 'en'
  // Newest writing first, the table's default order; those who never wrote go last.
  const ordered = useMemo(
    () => [...rows].sort((a, b) => (b.lastEntryDate ?? '').localeCompare(a.lastEntryDate ?? '') || a.name.localeCompare(b.name, 'es')),
    [rows],
  )

  return (
    <div className="mt-4 md:hidden">
      <ul className="grid list-none gap-2 p-0">
        {ordered.length === 0 && <li className="card px-4 py-4 font-light text-soft">{m.athletes_none()}</li>}
        {ordered.map((r) => (
          <li key={r._id} className="card px-4 py-3">
            <button type="button" className="w-full min-w-0 text-left" onClick={() => onOpen(r._id)}>
              <b className="font-disp text-[15px] leading-tight">{r.name}</b>
              <span className="mt-1.5 block font-mono text-[11px] text-soft">
                {r.branch === 'womens' ? m.reg_branch_womens() : m.reg_branch_mens()} ·{' '}
                {m.athletes_entries_n({ n: r.entryCount })}
                {r.lastEntryDate ? ` · ${formatDay(r.lastEntryDate, locale)}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 px-1 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
        {m.athletes_count({ n: ordered.length })}
      </p>
    </div>
  )
}
