import { describe, expect, it } from 'vitest'
import {
  dayEndMs,
  dayStartMs,
  formatDay,
  isWindowOpenFor,
  titleOf,
  validateCycle,
  windowOf,
} from '../convex/lib/cycleRules'

const C2026 = { cycle: '2026-2027', opensOn: '2026-09-04', closesOn: '2026-09-18', reviewOn: '2026-09-23' }

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

describe('validateCycle', () => {
  it('accepts the 2026 row', () => {
    expect(validateCycle(C2026)).toBeNull()
  })

  it('wants two consecutive years as the name', () => {
    expect(validateCycle({ ...C2026, cycle: '2026' })).toBe('cycle_name_invalid')
    expect(validateCycle({ ...C2026, cycle: '2026-2028' })).toBe('cycle_name_invalid')
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
