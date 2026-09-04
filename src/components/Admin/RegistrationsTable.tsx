import { useMemo } from 'react'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import * as m from '../../paraglide/messages.js'
import { SECTIONS_TOTAL } from '../../../convex/lib/decisionRules'
import { VIEWS, batchable, type AdminRow, type ViewId } from '../../lib/adminViews'
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
 * Sorting is the table's; filtering happened before the rows arrived (see
 * `adminViews.ts`), and selection is ours — the checkbox column only exists
 * in the one view where a batch can be sent, and only rows with a pending
 * notice may be ticked, because that is the only thing a batch can act on.
 */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text, alphanumeric: sortFn_alphanumeric },
})

const helper = createColumnHelper<typeof features, AdminRow>()

export default function RegistrationsTable({ rows, view, canSelect, selected, onSelectedChange, onOpen }: Props) {
  const fmt = useDateFormats()
  const selectable = canSelect && VIEWS[view].selectable
  const eligible = useMemo(() => new Set(batchable(rows).map((r) => r._id)), [rows])

  const columns = useMemo(() => {
    const cols = [
      helper.accessor('name', { header: m.regs_col_name, sortFn: 'text' }),
      helper.accessor('branch', {
        header: m.regs_col_branch,
        cell: (c) => (c.getValue() === 'womens' ? m.reg_branch_womens() : m.reg_branch_mens()),
      }),
      helper.accessor('status', { header: m.regs_col_status, cell: (c) => <StatusChip status={c.getValue()} /> }),
      helper.accessor('sectionsComplete', {
        header: m.regs_col_sections,
        sortFn: 'alphanumeric',
        cell: (c) => <span className="font-mono text-[12px]">{m.regs_sections({ n: c.getValue(), total: SECTIONS_TOTAL })}</span>,
      }),
      helper.display({
        id: 'guardian',
        header: m.regs_col_guardian,
        cell: (c) => <GuardianChip required={c.row.original.guardianRequired} confirmed={c.row.original.guardianConfirmed} />,
      }),
      helper.accessor('notice', { header: m.regs_col_notice, cell: (c) => <NoticeChip notice={c.getValue()} /> }),
      helper.accessor((r) => r.submittedAt ?? 0, {
        id: 'submittedAt',
        header: m.regs_col_submitted,
        sortFn: 'alphanumeric',
        cell: (c) => (c.getValue() ? fmt.full.format(new Date(c.getValue())) : '—'),
      }),
      helper.display({
        id: 'open',
        header: '',
        cell: (c) => (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(c.row.original._id)}>
            {m.regs_open()}
          </button>
        ),
      }),
    ]
    if (selectable) {
      cols.unshift(
        helper.display({
          id: 'select',
          header: () => (
            <input
              type="checkbox"
              aria-label={m.regs_select_all()}
              checked={eligible.size > 0 && [...eligible].every((id) => selected.has(id))}
              disabled={eligible.size === 0}
              onChange={(e) => onSelectedChange(e.target.checked ? new Set(eligible) : new Set())}
            />
          ),
          cell: (c) => {
            const id = c.row.original._id
            const ok = eligible.has(id)
            return (
              <input
                type="checkbox"
                aria-label={c.row.original.name}
                checked={selected.has(id)}
                disabled={!ok}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(id)
                  else next.delete(id)
                  onSelectedChange(next)
                }}
              />
            )
          },
        }),
      )
    }
    return helper.columns(cols)
  }, [eligible, fmt.full, onOpen, onSelectedChange, selectable, selected])

  const table = useTable({ features, columns, data: rows, initialState: { sorting: [VIEWS[view].sort] } })
  const body = table.getRowModel().rows

  return (
    <div className="card mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-line">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-3 py-2 text-left font-mono text-[10.5px] font-medium tracking-[.12em] uppercase text-soft"
                  aria-sort={h.column.getIsSorted() === 'asc' ? 'ascending' : h.column.getIsSorted() === 'desc' ? 'descending' : undefined}
                >
                  {h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <button type="button" className="font-inherit" onClick={h.column.getToggleSortingHandler()}>
                      <table.FlexRender header={h} />
                      {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                    </button>
                  ) : (
                    <table.FlexRender header={h} />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {body.length === 0 && (
            <tr>
              <td className="px-3 py-3 font-light text-soft" colSpan={99}>
                {m.regs_none()}
              </td>
            </tr>
          )}
          {body.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-middle">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">{m.regs_count({ n: body.length })}</p>
    </div>
  )
}
