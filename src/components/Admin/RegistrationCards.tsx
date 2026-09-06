import { useMemo } from 'react'
import * as m from '../../paraglide/messages.js'
import { SECTIONS_TOTAL } from '../../../convex/lib/decisionRules'
import { VIEWS, batchable, sortRows, type AdminRow, type ViewId } from '../../lib/adminViews'
import { useDateFormats } from '../DateField/format'
import { GuardianChip, NoticeChip, StatusChip } from './StatusChip'

type Props = {
  rows: AdminRow[]
  view: ViewId
  canSelect: boolean
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  onOpen: (id: string) => void
}

/**
 * The registrations, below `md`, where the table cannot go.
 *
 * `RegistrationsTable` is nine columns wide. On a phone that is a card you
 * scroll sideways inside, and once you have scrolled, nothing on screen
 * still says whose row you are reading — the count line ends up past the
 * right edge along with everything else. Neither is a layout problem that
 * more `overflow-x` solves, so at this width a row stops being a row.
 *
 * What a card keeps is what a reviewer scanning the queue actually reads:
 * the name, the state it is in, and the two chips that say whether anything
 * is blocking it. Branch, section count and date are demoted to one mono
 * line, and the rest of the table's columns are on the record itself, one
 * tap away.
 *
 * That tap is the whole card, which is also why the table's per-row *Abrir*
 * button is not here. A 44px button inside a 44px row was always the wrong
 * shape for a thumb, and a card that is itself the target does not need one.
 * The checkbox stays a separate target, since ticking a row and opening it
 * are different intentions.
 */
export default function RegistrationCards({ rows, view, canSelect, selected, onSelectedChange, onOpen }: Props) {
  const fmt = useDateFormats()
  const selectable = canSelect && VIEWS[view].selectable
  const eligible = useMemo(() => new Set(batchable(rows).map((r) => r._id)), [rows])
  const ordered = useMemo(() => sortRows(rows, VIEWS[view].sort), [rows, view])

  return (
    <div className="mt-4 md:hidden">
      <ul className="grid list-none gap-2 p-0">
        {ordered.length === 0 && <li className="card px-4 py-4 font-light text-soft">{m.regs_none()}</li>}
        {ordered.map((r) => (
          <li key={r._id} className="card flex items-start gap-3 px-4 py-3">
            {selectable && (
              <input
                type="checkbox"
                className="mt-1 size-[18px] shrink-0"
                aria-label={r.name}
                disabled={!eligible.has(r._id)}
                checked={selected.has(r._id)}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(r._id)
                  else next.delete(r._id)
                  onSelectedChange(next)
                }}
              />
            )}
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(r._id)}>
              <span className="flex items-start justify-between gap-2">
                <b className="font-disp text-[15px] leading-tight">{r.name}</b>
                <StatusChip status={r.status} />
              </span>
              <span className="mt-1.5 block font-mono text-[11px] text-soft">
                {r.branch === 'womens' ? m.reg_branch_womens() : m.reg_branch_mens()} ·{' '}
                {m.regs_sections({ n: r.sectionsComplete, total: SECTIONS_TOTAL })}
                {r.submittedAt ? ` · ${fmt.full.format(new Date(r.submittedAt))}` : ''}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <GuardianChip required={r.guardianRequired} confirmed={r.guardianConfirmed} />
                <NoticeChip notice={r.notice} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 px-1 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
        {m.regs_count({ n: ordered.length })}
      </p>
    </div>
  )
}
