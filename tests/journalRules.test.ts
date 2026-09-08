import { describe, expect, it } from 'vitest'
import {
  BODY_LIMIT,
  COMMENT_LIMIT,
  SCORE_LIMIT,
  TITLE_LIMIT,
  canDeleteEntry,
  todayISO,
  validateComment,
  validateEntry,
} from '../convex/lib/journalRules'

const TODAY = '2026-09-07'

const ok = { kind: 'tournament' as const, title: 'Copa Regional del Norte', date: '2026-09-05', body: 'Salí tenso al primer tee.', score: '71-74-70' }

describe('todayISO', () => {
  it('is the Mexico City day, not the UTC one', () => {
    // 03:00 UTC on the 8th is still 21:00 on the 7th in Mexico City.
    expect(todayISO(Date.parse('2026-09-08T03:00:00.000Z'))).toBe('2026-09-07')
    expect(todayISO(Date.parse('2026-09-08T06:00:00.000Z'))).toBe('2026-09-08')
  })
})

describe('validateEntry', () => {
  it('accepts a tournament with a score and a training session without one', () => {
    expect(validateEntry(ok, TODAY)).toBeNull()
    expect(validateEntry({ kind: 'training', title: 'Juego corto', date: TODAY, body: 'Bunker y approach.' }, TODAY)).toBeNull()
  })

  it('wants a title, within the limit', () => {
    expect(validateEntry({ ...ok, title: '  ' }, TODAY)).toBe('entry_title_required')
    expect(validateEntry({ ...ok, title: 'x'.repeat(TITLE_LIMIT + 1) }, TODAY)).toBe('entry_title_too_long')
    expect(validateEntry({ ...ok, title: 'x'.repeat(TITLE_LIMIT) }, TODAY)).toBeNull()
  })

  it('wants a real day, today or earlier', () => {
    expect(validateEntry({ ...ok, date: '2026-09-08' }, TODAY)).toBe('entry_date_invalid')
    expect(validateEntry({ ...ok, date: TODAY }, TODAY)).toBeNull()
    expect(validateEntry({ ...ok, date: '2026-13-01' }, TODAY)).toBe('entry_date_invalid')
    expect(validateEntry({ ...ok, date: 'ayer' }, TODAY)).toBe('entry_date_invalid')
  })

  it('wants a body, within the limit', () => {
    expect(validateEntry({ ...ok, body: '' }, TODAY)).toBe('entry_body_required')
    expect(validateEntry({ ...ok, body: 'x'.repeat(BODY_LIMIT + 1) }, TODAY)).toBe('entry_body_too_long')
  })

  it('lets only a tournament carry a score', () => {
    expect(validateEntry({ ...ok, kind: 'training' }, TODAY)).toBe('entry_score_not_allowed')
    expect(validateEntry({ ...ok, kind: 'training', score: '  ' }, TODAY)).toBeNull()
    expect(validateEntry({ ...ok, score: undefined }, TODAY)).toBeNull()
    expect(validateEntry({ ...ok, score: 'x'.repeat(SCORE_LIMIT + 1) }, TODAY)).toBe('entry_score_too_long')
  })
})

describe('validateComment', () => {
  it('wants text within the limit', () => {
    expect(validateComment('   ')).toBe('comment_required')
    expect(validateComment('x'.repeat(COMMENT_LIMIT + 1))).toBe('comment_too_long')
    expect(validateComment('Buen manejo del driver.')).toBeNull()
  })
})

describe('canDeleteEntry', () => {
  it('refuses once anyone has commented', () => {
    expect(canDeleteEntry({ commentCount: 0 })).toBeNull()
    expect(canDeleteEntry({ commentCount: 1 })).toBe('entry_has_comments')
  })
})
