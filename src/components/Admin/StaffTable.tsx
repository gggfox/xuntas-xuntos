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
import Pill, { type PillTone } from '../Pill'
import RoleChecks from './RoleChecks'
import RolePills from './RolePills'
import type { Role } from '../../lib/permissions'
import { useDateFormats } from '../DateField/format'
import { useFillHeight } from '../../hooks/useFillHeight'
import type { Id } from '../../../convex/_generated/dataModel'

type StaffRow = { _id: Id<'users'>; name?: string; email: string; roles: readonly Role[] }
type InviteRow = {
  _id: Id<'staffInvites'>
  email: string
  roles: readonly Role[]
  status: 'pending' | 'expired' | 'accepted' | 'revoked'
  expiresAt: number
  lastSentAt: number
  invitedByName: string
}

/** Which of the two tables the page is showing. */
export type StaffView = 'people' | 'invites'

type Props = {
  view: StaffView
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

/** Amber is the only one that asks for anything: a pending invite can be chased. */
const INVITE_TONE: Record<InviteRow['status'], PillTone> = {
  pending: 'warn',
  expired: 'neutral',
  accepted: 'ok',
  revoked: 'bad',
}

export default function StaffTable({
  view,
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
                  label={m.staff_col_roles()}
                  value={editing.roles}
                  onChange={(roles) => setEditing({ id: row._id, roles })}
                />
              )
            }
            /* All one tone: the roles are a list of facts, not a ranking, and
               the screen has already spent its yellow on the button that
               sends an invitation. Only the first is printed — see
               `RolePills` for why the rest hide behind a `+N`. */
            return <RolePills roles={row.roles} />
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
          cell: (c) => <RolePills roles={c.row.original.roles} />,
        }),
        inviteHelper.accessor('status', {
          header: m.staff_col_status,
          cell: (c) => <Pill tone={INVITE_TONE[c.getValue()]}>{INVITE_STATUS[c.getValue()]()}</Pill>,
        }),
        inviteHelper.accessor('invitedByName', { header: m.staff_col_invited_by }),
        inviteHelper.accessor('expiresAt', {
          header: m.staff_col_expires,
          cell: (c) => fmt.numeric.format(new Date(c.getValue())),
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
    [canManage, fmt.numeric, onResend, onRevoke],
  )

  const staffTable = useTable({ features, columns: staffColumns, data: staff })
  const inviteTable = useTable({ features, columns: inviteColumns, data: invites })

  /* Both tables are built either way — a hook cannot be called conditionally
     — but only the chosen one is drawn. The data behind them is a few dozen
     rows the page already holds, so building the other costs nothing worth
     saving. */
  return view === 'people' ? (
    <Table table={staffTable} empty={m.staff_none()} />
  ) : (
    <Table table={inviteTable} empty={m.staff_invites_none()} />
  )
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
  const card = useFillHeight<HTMLDivElement>()
  return (
    // `tall-*`: the card fills the window from `lg`; see styles.css.
    <div ref={card} className="card tall-card mt-3">
      <div className="tall-scroll overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead className="tall-head">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
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
    </div>
  )
}
