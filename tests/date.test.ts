import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  clamp,
  compare,
  daysInMonth,
  firstWeekday,
  parseISO,
  toISO,
  todayMX,
} from '../src/components/DateField/date'

describe('parseISO', () => {
  it('reads a well-formed date', () => {
    expect(parseISO('2005-06-23')).toEqual({ y: 2005, m: 6, d: 23 })
  })

  it('rejects days that month does not have', () => {
    expect(parseISO('2005-02-29')).toBeNull()
    expect(parseISO('2005-04-31')).toBeNull()
    expect(parseISO('2005-13-01')).toBeNull()
  })

  it('accepts February 29 in a leap year', () => {
    expect(parseISO('2004-02-29')).toEqual({ y: 2004, m: 2, d: 29 })
  })

  it('rejects anything that is not yyyy-mm-dd', () => {
    expect(parseISO('')).toBeNull()
    expect(parseISO('23/06/2005')).toBeNull()
    expect(parseISO('2005-6-23')).toBeNull()
  })
})

describe('toISO', () => {
  it('pads every part', () => {
    expect(toISO({ y: 2005, m: 6, d: 3 })).toBe('2005-06-03')
  })
})

describe('daysInMonth', () => {
  it('knows the centennial leap rule', () => {
    expect(daysInMonth(1900, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29)
    expect(daysInMonth(2004, 2)).toBe(29)
    expect(daysInMonth(2005, 2)).toBe(28)
  })
})

describe('firstWeekday', () => {
  it('places the 1st on the right day, 0 being Sunday', () => {
    // June 1, 2005 was a Wednesday; August 1, 2008 was a Friday.
    expect(firstWeekday(2005, 6)).toBe(3)
    expect(firstWeekday(2008, 8)).toBe(5)
  })
})

describe('addMonths', () => {
  it('clamps the day instead of spilling into the next month', () => {
    expect(addMonths({ y: 2005, m: 1, d: 31 }, 1)).toEqual({ y: 2005, m: 2, d: 28 })
    expect(addMonths({ y: 2004, m: 1, d: 31 }, 1)).toEqual({ y: 2004, m: 2, d: 29 })
  })

  it('crosses the year in both directions', () => {
    expect(addMonths({ y: 2005, m: 12, d: 15 }, 1)).toEqual({ y: 2006, m: 1, d: 15 })
    expect(addMonths({ y: 2005, m: 1, d: 15 }, -1)).toEqual({ y: 2004, m: 12, d: 15 })
  })
})

describe('addDays', () => {
  it('walks across a month and a leap day', () => {
    expect(addDays({ y: 2008, m: 8, d: 28 }, 7)).toEqual({ y: 2008, m: 9, d: 4 })
    expect(addDays({ y: 2004, m: 2, d: 28 }, 1)).toEqual({ y: 2004, m: 2, d: 29 })
    expect(addDays({ y: 2005, m: 1, d: 1 }, -1)).toEqual({ y: 2004, m: 12, d: 31 })
  })
})

describe('compare and clamp', () => {
  it('orders by year, then month, then day', () => {
    expect(compare({ y: 2005, m: 6, d: 23 }, { y: 2005, m: 6, d: 24 })).toBeLessThan(0)
    expect(compare({ y: 2005, m: 7, d: 1 }, { y: 2005, m: 6, d: 30 })).toBeGreaterThan(0)
    expect(compare({ y: 2005, m: 6, d: 23 }, { y: 2005, m: 6, d: 23 })).toBe(0)
  })

  it('pulls a date back inside the range and leaves the ones inside alone', () => {
    const lo = { y: 1930, m: 1, d: 1 }
    const hi = { y: 2026, m: 8, d: 28 }
    expect(clamp({ y: 1900, m: 5, d: 5 }, lo, hi)).toEqual(lo)
    expect(clamp({ y: 2030, m: 5, d: 5 }, lo, hi)).toEqual(hi)
    expect(clamp({ y: 2005, m: 6, d: 23 }, lo, hi)).toEqual({ y: 2005, m: 6, d: 23 })
  })
})

describe('todayMX', () => {
  it('is still yesterday in Mexico when UTC has already turned the page', () => {
    // 2026-08-29T03:00Z is 9 p.m. on the 28th in central Mexico.
    expect(todayMX(Date.parse('2026-08-29T03:00:00.000Z'))).toEqual({ y: 2026, m: 8, d: 28 })
    expect(todayMX(Date.parse('2026-08-29T06:00:00.000Z'))).toEqual({ y: 2026, m: 8, d: 29 })
  })
})
