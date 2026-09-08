import { useMemo } from 'react'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import * as m from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { formatDay } from '../../../convex/lib/cycleRules'
import type { Role } from '../../lib/permissions'
import RolePills from './RolePills'

export type AthleteRow = {
  _id: string
  name: string
  branch: 'womens' | 'mens'
  entryCount: number
  lastEntryDate?: string
  /** Present for administration, which sees every member's team. */
  staff?: Array<{ name: string; roles: string[] }>
}

type Props = {
  rows: AthleteRow[]
  /** Whether to draw the team column. Administration only. */
  showStaff: boolean
  onOpen: (id: string) => void
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})

const helper = createColumnHelper<typeof features, AthleteRow>()

/** Newest writing first: a coach opens this to see who wrote since last time. */
export const DEFAULT_SORT = { id: 'lastEntryDate', desc: true }

/**
 * The members a staff account may see, from `md` up. Below that,
 * `AthleteCards`. Same table engine and the same shell as `StaffTable`.
 */
export default function AthletesTable({ rows, showStaff, onOpen }: Props) {
  const locale = getLocale() as 'es' | 'en'

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', { header: m.athletes_col_name, sortFn: 'text' }),
        helper.accessor('branch', {
          header: m.athletes_col_branch,
          cell: (c) => (c.getValue() === 'womens' ? m.reg_branch_womens() : m.reg_branch_mens()),
        }),
        helper.accessor((r) => r.lastEntryDate ?? '', {
          id: 'lastEntryDate',
          header: m.athletes_col_last_entry,
          sortFn: 'text',
          cell: (c) => (c.getValue() ? formatDay(c.getValue(), locale) : <span className="text-soft">{m.athletes_no_entries()}</span>),
        }),
        helper.accessor('entryCount', { header: m.athletes_col_entries }),
        ...(showStaff
          ? [
              helper.display({
                id: 'staff',
                header: m.athletes_col_staff,
                cell: (c) => {
                  const staff = c.row.original.staff ?? []
                  if (staff.length === 0) return <span className="text-soft">{m.detail_empty()}</span>
                  return (
                    <ul className="m-0 grid list-none gap-1 p-0">
                      {staff.map((s, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-1.5">
                          <span>{s.name}</span>
                          <RolePills roles={s.roles as Role[]} />
                        </li>
                      ))}
                    </ul>
                  )
                },
              }),
            ]
          : []),
        helper.display({
          id: 'open',
          header: '',
          cell: (c) => (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(c.row.original._id)}>
              {m.regs_open()}
            </button>
          ),
        }),
      ]),
    [locale, onOpen, showStaff],
  )

  const table = useTable({ features, columns, data: rows, initialState: { sorting: [DEFAULT_SORT] } })
  const body = table.getRowModel().rows

  return (
    <div className="card mt-3 hidden overflow-x-auto md:block">
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
                {m.athletes_none()}
              </td>
            </tr>
          )}
          {body.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-top">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
        {m.athletes_count({ n: rows.length })}
      </p>
    </div>
  )
}
