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

export function applyFilters(rows: AdminRow[], f: Filters): AdminRow[] {
  return rows.filter(
    (r) =>
      (f.status === 'any' || r.status === f.status) &&
      (f.branch === 'any' || r.branch === f.branch) &&
      (f.guardian === 'any' ||
        (f.guardian === 'pending' ? r.guardianRequired && !r.guardianConfirmed : r.guardianConfirmed)) &&
      r.sectionsComplete >= f.minSections &&
      (f.notice === 'any' || r.notice === f.notice),
  )
}

/** What a batch may send: rows whose notice is waiting. */
export function batchable(rows: AdminRow[]): AdminRow[] {
  return rows.filter((r) => r.notice === 'not_sent')
}
