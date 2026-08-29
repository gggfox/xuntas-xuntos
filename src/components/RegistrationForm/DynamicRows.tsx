import * as m from '../../paraglide/messages.js'

export type RowValue = { a: string; b: string }

/**
 * Rows that grow: results and calendar.
 *
 * Presentational. It does not own the array — the form does — so it takes one
 * handler per operation rather than handing back a whole new list. That is
 * what lets the caller map straight onto a TanStack array field's
 * `pushValue` / `removeValue` without rebuilding the array by hand.
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
}: {
  rows: RowValue[]
  phA: string
  phB: string
  addLabel: string
  onEdit: (index: number, key: 'a' | 'b', value: string) => void
  onRemove: (index: number) => void
  onAdd: () => void
  onBlur?: () => void
}) {
  return (
    <>
      {rows.map((f, i) => (
        <div key={i} className="mb-[9px] grid grid-cols-[1fr_150px_40px] items-center gap-[9px]">
          <input
            className="fld-input"
            placeholder={phA}
            aria-label={`${phA} ${i + 1}`}
            value={f.a}
            onChange={(e) => onEdit(i, 'a', e.target.value)}
            onBlur={onBlur}
          />
          <input
            className="fld-input"
            placeholder={phB}
            aria-label={`${phB} ${i + 1}`}
            value={f.b}
            onChange={(e) => onEdit(i, 'b', e.target.value)}
            onBlur={onBlur}
          />
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
