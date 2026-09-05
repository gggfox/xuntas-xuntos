import { describe, expect, it } from 'vitest'
import {
  cycleTitle,
  dayEndMs,
  dayStartMs,
  formatDay,
  isWindowOpenFor,
  titleOf,
  validateCycle,
  windowOf,
  windowStatusAt,
} from '../convex/lib/cycleRules'

const C2026 = {
  cycle: '2026-2027',
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

  it('accepts a key that is not a date range at all', () => {
    expect(validateCycle({ ...C2026, cycle: '2026-2027-verano' })).toBeNull()
    expect(validateCycle({ ...C2026, cycle: 'beca-invierno' })).toBeNull()
  })

  it('is case-insensitive and stores the key as typed', () => {
    expect(validateCycle({ ...C2026, cycle: 'BECA-INVIERNO' })).toBeNull()
  })

  it('refuses spaces, punctuation, and lengths outside 2-40', () => {
    expect(validateCycle({ ...C2026, cycle: '2026 2027' })).toBe('cycle_key_invalid')
    expect(validateCycle({ ...C2026, cycle: '2026_2027' })).toBe('cycle_key_invalid')
    expect(validateCycle({ ...C2026, cycle: '2026/2027' })).toBe('cycle_key_invalid')
    expect(validateCycle({ ...C2026, cycle: 'a' })).toBe('cycle_key_invalid')
    expect(validateCycle({ ...C2026, cycle: 'a'.repeat(41) })).toBe('cycle_key_invalid')
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
  it('derives the title from the name', () => {
    expect(titleOf('2026-2027', 'es')).toBe('Convocatoria General 2026–2027')
    expect(titleOf('2026-2027', 'en')).toBe('2026–2027 General Call for Applications')
  })

  it('spells a day out the way the copy already did', () => {
    expect(formatDay('2026-09-18', 'es')).toBe('18 de septiembre de 2026')
    expect(formatDay('2026-09-18', 'en')).toBe('September 18, 2026')
  })
})

/**
 * `cycleTitle` is what every screen and email shows for a call's name now —
 * a typed title when there is one, `titleOf`'s derivation for a row written
 * before titles existed.
 */
describe('cycleTitle', () => {
  it('prefers the typed title', () => {
    expect(cycleTitle({ cycle: 'beca-invierno', title: 'Beca de Invierno' }, 'es')).toBe('Beca de Invierno')
  })

  it('falls back to titleOf when the title is missing, empty, or blank', () => {
    expect(cycleTitle({ cycle: '2026-2027' }, 'es')).toBe(titleOf('2026-2027', 'es'))
    expect(cycleTitle({ cycle: '2026-2027', title: '' }, 'en')).toBe(titleOf('2026-2027', 'en'))
    expect(cycleTitle({ cycle: '2026-2027', title: '   ' }, 'es')).toBe(titleOf('2026-2027', 'es'))
  })
})
