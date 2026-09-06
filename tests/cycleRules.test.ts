import { describe, expect, it } from 'vitest'
import {
  dayEndMs,
  dayStartMs,
  formatDay,
  isWindowOpenFor,
  validateCycle,
  windowOf,
  windowStatusAt,
} from '../convex/lib/cycleRules'

const C2026 = {
  title: 'Convocatoria General 2026–2027',
  opensOn: '2026-09-04',
  closesOn: '2026-09-18',
  reviewOn: '2026-09-23',
}

describe('day boundaries in Mexico City', () => {
  /** The values the constants used to hold, so nothing moves when the row replaces them. */
  it('reproduces the 2026 constants', () => {
    expect(dayStartMs('2026-09-04')).toBe(Date.parse('2026-09-04T06:00:00.000Z'))
    expect(dayEndMs('2026-09-18')).toBe(Date.parse('2026-09-19T05:59:59.999Z'))
  })

  it('refuses a day that is not one', () => {
    expect(dayStartMs('2026-02-30')).toBeNull()
    expect(dayEndMs('18/09/2026')).toBeNull()
  })
})

describe('isWindowOpenFor', () => {
  const { opensAtMs, closesAtMs } = windowOf(C2026)

  it('is closed before opening and open right at opening time', () => {
    expect(isWindowOpenFor(C2026, opensAtMs - 1)).toBe(false)
    expect(isWindowOpenFor(C2026, opensAtMs)).toBe(true)
  })

  it('is still open at the last millisecond and closes afterwards', () => {
    expect(isWindowOpenFor(C2026, closesAtMs)).toBe(true)
    expect(isWindowOpenFor(C2026, closesAtMs + 1)).toBe(false)
  })
})

/**
 * The client-side counterpart of `isWindowOpenFor`, taking the raw instants
 * a query already returns instead of the day strings — see
 * `src/hooks/useActiveCycle.ts`, which must recompute this on every render
 * rather than trust a value cached in a reactive query.
 */
describe('windowStatusAt', () => {
  const { opensAtMs, closesAtMs } = windowOf(C2026)

  it('is before opening, then open, then closed, in that order', () => {
    expect(windowStatusAt(opensAtMs, closesAtMs, opensAtMs - 1)).toEqual({
      isOpen: false,
      beforeOpening: true,
    })
    expect(windowStatusAt(opensAtMs, closesAtMs, opensAtMs)).toEqual({
      isOpen: true,
      beforeOpening: false,
    })
    expect(windowStatusAt(opensAtMs, closesAtMs, closesAtMs)).toEqual({
      isOpen: true,
      beforeOpening: false,
    })
    expect(windowStatusAt(opensAtMs, closesAtMs, closesAtMs + 1)).toEqual({
      isOpen: false,
      beforeOpening: false,
    })
  })
})

describe('validateCycle', () => {
  it('accepts the 2026 row', () => {
    expect(validateCycle(C2026)).toBeNull()
  })

  /**
   * A call has no key to shape-check any more — its `_id` is minted by
   * Convex, never typed. `title` is the only thing an admin types, and it
   * can be any free text at all as long as it is not blank.
   */
  it('accepts any non-blank title, not just a date-shaped one', () => {
    expect(validateCycle({ ...C2026, title: 'Beca de Invierno' })).toBeNull()
    expect(validateCycle({ ...C2026, title: '2026-2027-verano' })).toBeNull()
    expect(validateCycle({ ...C2026, title: 'a' })).toBeNull()
  })

  it('wants a title that is not blank or only whitespace', () => {
    expect(validateCycle({ ...C2026, title: '' })).toBe('cycle_title_required')
    expect(validateCycle({ ...C2026, title: '   ' })).toBe('cycle_title_required')
  })

  it('refuses a close before the open, and unreadable days', () => {
    expect(validateCycle({ ...C2026, closesOn: '2026-09-03' })).toBe('cycle_dates_invalid')
    expect(validateCycle({ ...C2026, opensOn: 'soon' })).toBe('cycle_dates_invalid')
  })

  it('allows a one-day window', () => {
    expect(validateCycle({ ...C2026, closesOn: '2026-09-04' })).toBeNull()
  })

  it('wants the review after the close', () => {
    expect(validateCycle({ ...C2026, reviewOn: '2026-09-18' })).toBe('cycle_review_before_close')
  })
})

describe('copy helpers', () => {
  it('spells a day out the way the copy already did', () => {
    expect(formatDay('2026-09-18', 'es')).toBe('18 de septiembre de 2026')
    expect(formatDay('2026-09-18', 'en')).toBe('September 18, 2026')
  })
})
