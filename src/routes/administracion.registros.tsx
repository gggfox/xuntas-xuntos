import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as m from '../paraglide/messages.js'
import BatchSendDialog from '../components/Admin/BatchSendDialog'
import NoTools from '../components/Admin/NoTools'
import RegistrationFilters from '../components/Admin/RegistrationFilters'
import RegistrationsTable from '../components/Admin/RegistrationsTable'
import { useActiveCycle } from '../hooks/useActiveCycle'
import { useAdminCycle } from '../hooks/useAdminCycle'
import { useMe } from '../hooks/useMe'
import { VIEWS, applyFilters, type Filters, type ViewId } from '../lib/adminViews'
import { can } from '../lib/permissions'
import { describeConvexError } from '../lib/registrationErrors'

export const Route = createFileRoute('/administracion/registros')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.regs_title() }) }] }),
  validateSearch: (s: Record<string, unknown>): { vista?: ViewId } =>
    s.vista === 'pending' || s.vista === 'all' || s.vista === 'incomplete' ? { vista: s.vista } : {},
  component: RegistrationsPage,
})

const VIEW_LABEL: Record<ViewId, () => string> = {
  pending: m.regs_view_pending,
  all: m.regs_view_all,
  incomplete: m.regs_view_incomplete,
}

/**
 * Where reviewers land: three presets over one query (`adminViews.ts`), a
 * filter bar that narrows further, and — only in *Todos*, only for an
 * account that may send a batch — a selection that survives switching
 * filters but not switching views, because a selection made under one
 * view's rows stops meaning anything once the rows underneath it change.
 *
 * Opening a row is wired to the detail route the next task adds; nothing
 * here depends on that page existing.
 */
function RegistrationsPage() {
  const me = useMe()
  const { cycle } = useAdminCycle()
  const active = useActiveCycle()
  const { vista } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const view: ViewId = vista ?? 'pending'

  const rows = useQuery(api.registrations.listForAdmin, cycle && me && can(me.roles, 'review_registrations') ? { cycle } : 'skip')
  const sendBatch = useMutation(api.notices.sendBatch)
  const sendTest = useMutation(api.notices.sendTest)

  const [filters, setFilters] = useState<Filters>(VIEWS[view].filters)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shown = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters])

  if (!me) return null
  if (!can(me.roles, 'review_registrations')) return <NoTools />
  if (rows === undefined || !cycle) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  const canBatch = can(me.roles, 'send_batch')
  // The batch's own cycle gates it, not whichever cycle happens to be active
  // right now — a reviewer looking at a past cycle must not be told its
  // window is open just because this year's is.
  const windowOpen = active?.cycle === cycle ? (active?.isOpen ?? true) : false

  function switchView(v: ViewId) {
    setFilters(VIEWS[v].filters)
    setSelected(new Set())
    void navigate({ search: { vista: v }, replace: true })
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2" role="tablist">
        {(Object.keys(VIEWS) as ViewId[]).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === view}
            className={`rounded-ctl border px-3 py-1.5 font-mono text-[11.5px] tracking-[.08em] uppercase ${
              v === view ? 'border-line-2 text-ink' : 'border-transparent text-soft hover:text-ink'
            }`}
            onClick={() => switchView(v)}
          >
            {VIEW_LABEL[v]()}
          </button>
        ))}
        {canBatch && view === 'all' && (
          <button type="button" className="btn btn-sm ml-auto" disabled={selected.size === 0} onClick={() => setDialog(true)}>
            {m.regs_send_batch()} · {m.regs_selected({ n: selected.size })}
          </button>
        )}
      </div>

      <RegistrationFilters value={filters} onChange={setFilters} lockStatus={view !== 'all'} />
      {error && <p className="mt-3 text-[12.5px] text-bad">{error}</p>}

      <RegistrationsTable
        // v9's table instance is built once, on mount, from `initialState` —
        // it does not re-seed sorting from a later `initialState` prop. Each
        // view has its own default sort (see `VIEWS`), so the key forces a
        // fresh instance when the tab changes instead of carrying the old
        // view's sort into the new one.
        key={view}
        rows={shown}
        view={view}
        canSelect={canBatch}
        selected={selected}
        onSelectedChange={setSelected}
        onOpen={(id) =>
          // The detail route (`/administracion/registros/$id`) is the next
          // task's file, so today's generated route tree does not know its
          // path or its `id` param and cannot type-check a call to it. The
          // cast is narrowly scoped to this one navigation and goes away
          // the moment that route file exists and `generate-routes` picks
          // it up.
          void navigate({ to: '/administracion/registros/$id', params: { id } } as never)
        }
      />

      {dialog && (
        <BatchSendDialog
          count={selected.size}
          windowOpen={windowOpen}
          onConfirm={async () => {
            try {
              const r = await sendBatch({ cycle, ids: [...selected] as Id<'registrations'>[] })
              setSelected(new Set())
              return r
            } catch (err) {
              setError(describeConvexError(err))
              return { scheduled: 0, skipped: selected.size }
            }
          }}
          onTest={async () => {
            await sendTest({ cycle, decision: 'selected' })
          }}
          onClose={() => setDialog(false)}
        />
      )}
    </>
  )
}
