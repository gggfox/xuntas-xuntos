import { useMemo, useState } from 'react'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
  type ReactTable,
} from '@tanstack/react-table'
import * as m from '../../paraglide/messages.js'
import RoleChecks, { roleName } from './RoleChecks'
import type { Role } from '../../lib/permissions'
import { useDateFormats } from '../DateField/format'
import type { Id } from '../../../convex/_generated/dataModel'

export type StaffRow = { _id: Id<'users'>; name?: string; email: string; roles: readonly Role[] }
export type InviteRow = {
  _id: Id<'staffInvites'>
  email: string
  roles: readonly Role[]
  status: 'pending' | 'expired' | 'accepted' | 'revoked'
  expiresAt: number
  lastSentAt: number
  invitedByName: string
}

type Props = {
  staff: StaffRow[]
  invites: InviteRow[]
  canManage: boolean
  /** `undefined` while the signed-in account has not loaded into `staff` yet. */
  meId: Id<'users'> | undefined
  onSetRoles: (userId: Id<'users'>, roles: Role[]) => Promise<void>
  onResend: (inviteId: Id<'staffInvites'>) => Promise<void>
  onRevoke: (inviteId: Id<'staffInvites'>) => Promise<void>
}

/**
 * v9 asks for the features up front so the bundle only carries what the
 * table uses: sorting here, nothing else. Filtering happens on the data
 * before it reaches the table — a few dozen rows do not need an engine.
 */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})

const staffHelper = createColumnHelper<typeof features, StaffRow>()
const inviteHelper = createColumnHelper<typeof features, InviteRow>()

const INVITE_STATUS: Record<InviteRow['status'], () => string> = {
  pending: m.invite_status_pending,
  expired: m.invite_status_expired,
  accepted: m.invite_status_accepted,
  revoked: m.invite_status_revoked,
}

const CHIP: Record<InviteRow['status'], string> = {
  pending: 'chip chip-warn',
  expired: 'chip',
  accepted: 'chip chip-ok',
  revoked: 'chip chip-bad',
}

export default function StaffTable({
  staff,
  invites,
  canManage,
  meId,
  onSetRoles,
  onResend,
  onRevoke,
}: Props) {
  const fmt = useDateFormats()
  /** Which row is being edited, and the roles typed so far. */
  const [editing, setEditing] = useState<{ id: Id<'users'>; roles: Role[] } | null>(null)

  const staffColumns = useMemo(
    () =>
      staffHelper.columns([
        staffHelper.accessor((r) => r.name ?? '', {
          id: 'name',
          header: m.staff_col_name,
          sortFn: 'text',
          cell: (c) => (
            <>
              {c.getValue()}
              {c.row.original._id === meId && (
                <span className="ml-2 font-mono text-[10px] text-soft">({m.staff_you()})</span>
              )}
            </>
          ),
        }),
        staffHelper.accessor('email', { header: m.staff_col_email, sortFn: 'text' }),
        staffHelper.display({
          id: 'roles',
          header: m.staff_col_roles,
          cell: (c) => {
            const row = c.row.original
            if (editing?.id === row._id) {
              return (
                <RoleChecks
                  idPrefix={`edit-${row._id}`}
                  value={editing.roles}
                  onChange={(roles) => setEditing({ id: row._id, roles })}
                />
              )
            }
            return (
              <span className="flex flex-wrap gap-1">
                {row.roles.map((r) => (
                  <span key={r} className="chip">
                    {roleName(r)}
                  </span>
                ))}
              </span>
            )
          },
        }),
        staffHelper.display({
          id: 'actions',
          header: '',
          cell: (c) => {
            if (!canManage) return null
            const row = c.row.original
            if (editing?.id === row._id) {
              return (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      void onSetRoles(row._id, editing.roles)
                      setEditing(null)
                    }}
                  >
                    {m.staff_save()}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                    {m.staff_cancel()}
                  </button>
                </span>
              )
            }
            return (
              <span className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing({ id: row._id, roles: [...row.roles] })}
                >
                  {m.staff_edit()}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm hover:border-bad hover:text-bad"
                  onClick={() => void onSetRoles(row._id, [])}
                >
                  {m.staff_remove()}
                </button>
              </span>
            )
          },
        }),
      ]),
    [canManage, editing, meId, onSetRoles],
  )

  const inviteColumns = useMemo(
    () =>
      inviteHelper.columns([
        inviteHelper.accessor('email', { header: m.staff_col_email, sortFn: 'text' }),
        inviteHelper.display({
          id: 'roles',
          header: m.staff_col_roles,
          cell: (c) => c.row.original.roles.map(roleName).join(', '),
        }),
        inviteHelper.accessor('status', {
          header: m.staff_col_status,
          cell: (c) => <span className={CHIP[c.getValue()]}>{INVITE_STATUS[c.getValue()]()}</span>,
        }),
        inviteHelper.accessor('invitedByName', { header: m.staff_col_invited_by }),
        inviteHelper.accessor('expiresAt', {
          header: m.staff_col_expires,
          cell: (c) => fmt.full.format(new Date(c.getValue())),
        }),
        inviteHelper.display({
          id: 'actions',
          header: '',
          cell: (c) => {
            const row = c.row.original
            if (!canManage || row.status !== 'pending') return null
            return (
              <span className="flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onResend(row._id)}>
                  {m.staff_resend()}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm hover:border-bad hover:text-bad"
                  onClick={() => void onRevoke(row._id)}
                >
                  {m.staff_revoke()}
                </button>
              </span>
            )
          },
        }),
      ]),
    [canManage, fmt.full, onResend, onRevoke],
  )

  const staffTable = useTable({ features, columns: staffColumns, data: staff })
  const inviteTable = useTable({ features, columns: inviteColumns, data: invites })

  return (
    <>
      <h2 className="h-display mt-9 text-[18px]">{m.staff_people_title()}</h2>
      <StaffRows table={staffTable} empty={m.staff_none()} />
      <h2 className="h-display mt-9 text-[18px]">{m.staff_invites_title()}</h2>
      <InviteRows table={inviteTable} empty={m.staff_none()} />
    </>
  )
}

function StaffRows({ table, empty }: { table: ReactTable<typeof features, StaffRow>; empty: string }) {
  return <Table table={table} empty={empty} />
}

function InviteRows({ table, empty }: { table: ReactTable<typeof features, InviteRow>; empty: string }) {
  return <Table table={table} empty={empty} />
}

/**
 * One rendering for both tables. `table.FlexRender` is v9's replacement for
 * the `flexRender` function; header cells toggle sorting when they can.
 */
function Table<TRow extends StaffRow | InviteRow>({
  table,
  empty,
}: {
  table: ReactTable<typeof features, TRow>
  empty: string
}) {
  const rows = table.getRowModel().rows
  return (
    <div className="card mt-3 overflow-x-auto">
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
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-3 font-light text-soft" colSpan={99}>
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
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
    </div>
  )
}
