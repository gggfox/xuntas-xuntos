import type { NoticeDecision, NoticeStatus, RegistrationStatus } from '../../convex/lib/decisionRules'

/**
 * The three views are presets over one query, not three queries. Filtering
 * a few hundred rows in the browser is instant and keeps the table reactive
 * to every decision someone else makes.
 */
export type AdminRow = {
  _id: string
  status: RegistrationStatus
  submittedAt?: number
  updatedAt: number
  name: string
  email: string
  branch: 'womens' | 'mens'
  state: string
  isMinor: boolean
  guardianRequired: boolean
  guardianConfirmed: boolean
  sectionsComplete: number
  notice: NoticeStatus | null
  decision: NoticeDecision | null
}

export type ViewId = 'pending' | 'all' | 'incomplete'

export type Filters = {
  status: RegistrationStatus | 'any'
  branch: 'womens' | 'mens' | 'any'
  guardian: 'any' | 'pending' | 'ok'
  minSections: number
  notice: NoticeStatus | 'any'
}

const ANY: Filters = { status: 'any', branch: 'any', guardian: 'any', minSections: 0, notice: 'any' }

export const VIEWS: Record<ViewId, { filters: Filters; sort: { id: string; desc: boolean }; selectable: boolean }> = {
  pending: { filters: { ...ANY, status: 'submitted' }, sort: { id: 'submittedAt', desc: false }, selectable: false },
  all: { filters: ANY, sort: { id: 'name', desc: false }, selectable: true },
  incomplete: { filters: { ...ANY, status: 'draft' }, sort: { id: 'sectionsComplete', desc: false }, selectable: false },
}

/**
 * The order a view opens in, applied outside the table.
 *
 * `RegistrationsTable` sorts itself — that is TanStack's job and a header is
 * there to be clicked. The card list below `md` has no headers to click, so
 * it takes the view's default order from here and keeps it. Both therefore
 * agree about what the first row is, which is the only thing that would be
 * noticed if they did not.
 */
export function sortRows(rows: AdminRow[], sort: { id: string; desc: boolean }): AdminRow[] {
  const key = (r: AdminRow): string | number => {
    switch (sort.id) {
      case 'submittedAt':
        return r.submittedAt ?? 0
      case 'sectionsComplete':
        return r.sectionsComplete
      default:
        return r.name
    }
  }
  return [...rows].sort((a, b) => {
    const x = key(a)
    const y = key(b)
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')
    return sort.desc ? -c : c
  })
}

export function applyFilters(rows: AdminRow[], f: Filters): AdminRow[] {
  const matchAnyOrFilter = <T>(value: T, filter: T | 'any'): boolean => filter === 'any' || value === filter

  return rows.filter(
    (r) =>
      matchAnyOrFilter(r.status, f.status) &&
      matchAnyOrFilter(r.branch, f.branch) &&
      matchAnyOrFilter(r.notice, f.notice) &&
      (f.guardian === 'any' ||
        (f.guardian === 'pending' ? r.guardianRequired && !r.guardianConfirmed : r.guardianConfirmed)) &&
      r.sectionsComplete >= f.minSections
  )
}

/**
 * What a batch may send: rows whose notice is waiting, excluding rejections.
 * A rejection goes out individually through `sendRejection` precisely so it
 * need not wait for the window to close — offering it here would let it
 * inflate the count the dialog promises before `sendBatch` silently skips
 * it, which is a promise the screen cannot keep.
 */
export function batchable(rows: AdminRow[]): AdminRow[] {
  return rows.filter((r) => r.notice === 'not_sent' && r.decision !== 'rejected')
}
