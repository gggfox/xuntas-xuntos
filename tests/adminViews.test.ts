import { describe, expect, it } from 'vitest'
import { VIEWS, applyFilters, batchable, type AdminRow } from '../src/lib/adminViews'

const row = (over: Partial<AdminRow>): AdminRow => ({
  _id: 'r',
  status: 'submitted',
  updatedAt: 0,
  name: 'Ana',
  email: 'a@x.org',
  branch: 'womens',
  state: 'NL',
  isMinor: false,
  guardianRequired: false,
  guardianConfirmed: true,
  sectionsComplete: 7,
  notice: null,
  decision: null,
  ...over,
})

const rows = [
  row({ _id: 'a', status: 'submitted' }),
  row({ _id: 'b', status: 'draft', sectionsComplete: 3 }),
  row({ _id: 'c', status: 'validated', branch: 'mens', guardianRequired: true, guardianConfirmed: false }),
  row({ _id: 'd', status: 'rejected', notice: 'not_sent', decision: 'rejected' }),
]

describe('view presets', () => {
  it('pending shows only submitted', () => {
    expect(applyFilters(rows, VIEWS.pending.filters).map((r) => r._id)).toEqual(['a'])
  })
  it('incomplete shows only drafts, sorted by sections ascending', () => {
    expect(applyFilters(rows, VIEWS.incomplete.filters).map((r) => r._id)).toEqual(['b'])
    expect(VIEWS.incomplete.sort).toEqual({ id: 'sectionsComplete', desc: false })
  })
  it('all shows everything and is the only selectable view', () => {
    expect(applyFilters(rows, VIEWS.all.filters)).toHaveLength(4)
    expect(VIEWS.all.selectable).toBe(true)
    expect(VIEWS.pending.selectable).toBe(false)
  })
})

describe('applyFilters', () => {
  it('filters by branch, guardian and minimum sections', () => {
    expect(applyFilters(rows, { ...VIEWS.all.filters, branch: 'mens' }).map((r) => r._id)).toEqual(['c'])
    expect(applyFilters(rows, { ...VIEWS.all.filters, guardian: 'pending' }).map((r) => r._id)).toEqual(['c'])
    expect(applyFilters(rows, { ...VIEWS.all.filters, minSections: 5 })).toHaveLength(3)
  })
  it('filters by notice state', () => {
    expect(applyFilters(rows, { ...VIEWS.all.filters, notice: 'not_sent' }).map((r) => r._id)).toEqual(['d'])
  })
})

describe('batchable', () => {
  it('keeps only rows with a pending notice', () => {
    expect(batchable(rows).map((r) => r._id)).toEqual(['d'])
  })
})
