import type { ReactNode } from 'react'
import * as m from '../../paraglide/messages.js'

export type RowValue = { a: string; b: string }

/**
 * Rows that grow: results and calendar.
 *
 * Presentational. It does not own the array — the form does — so it takes one
 * handler per operation rather than handing back a whole new list. That is
 * what lets the caller map straight onto a TanStack array field's
 * `pushValue` / `removeValue` without rebuilding the array by hand.
 *
 * The two sections disagree about only one thing: what the second column is.
 * A result is prose — `1º`, `T5`, `corte` — and stays a text box. A calendar
 * entry is a month, and gets a picker. That is what `renderB` is for; leaving
 * it out keeps the text box, so the results rows say nothing about a column
 * they do not have an opinion on.
 */
export default function DynamicRows({
  rows,
  phA,
  phB,
  addLabel,
  onEdit,
  onRemove,
  onAdd,
  onBlur,
  renderB,
}: {
  rows: RowValue[]
  phA: string
  phB: string
  addLabel: string
  onEdit: (index: number, key: 'a' | 'b', value: string) => void
  onRemove: (index: number) => void
  onAdd: () => void
  onBlur?: () => void
  /** Replaces the second column's text box. Given the row's index and value. */
  renderB?: (index: number, value: string, label: string) => ReactNode
}) {
  return (
    <>
      {rows.map((f, i) => (
        /* Top-aligned when the second column brings its own reserved error
           line, so the three cells still start on one line and every row is
           the same height whether or not anything is wrong. */
        <div
          key={i}
          className={`mb-[9px] grid grid-cols-[1fr_150px_40px] gap-[9px] ${
            renderB ? 'items-start' : 'items-center'
          }`}
        >
          <input
            className="fld-input"
            placeholder={phA}
            aria-label={`${phA} ${i + 1}`}
            value={f.a}
            onChange={(e) => onEdit(i, 'a', e.target.value)}
            onBlur={onBlur}
          />
          {renderB ? (
            renderB(i, f.b, `${phB} ${i + 1}`)
          ) : (
            <input
              className="fld-input"
              placeholder={phB}
              aria-label={`${phB} ${i + 1}`}
              value={f.b}
              onChange={(e) => onEdit(i, 'b', e.target.value)}
              onBlur={onBlur}
            />
          )}
          <button
            type="button"
            className="rounded-ctl border border-line-2 py-2 text-soft hover:border-bad hover:text-bad"
            aria-label={m.reg_remove_row({ n: i + 1 })}
            onClick={() => onRemove(i)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={onAdd}>
        {addLabel}
      </button>
    </>
  )
}
