import { describe, expect, it } from 'vitest'
import { ageAt, isUnderage, isValidBirthDate } from '../convex/lib/cycle'

/** September 10, 2026, noon in central Mexico. */
const DURING = Date.parse('2026-09-10T18:00:00.000Z')

describe('ageAt', () => {
  it('counts completed years', () => {
    expect(ageAt('2000-01-01', DURING)).toBe(26)
  })

  it('does not turn a year older until the day itself', () => {
    expect(ageAt('2008-09-11', DURING)).toBe(17)
    expect(ageAt('2008-09-10', DURING)).toBe(18)
  })

  it('returns -1 when the date cannot be understood', () => {
    expect(ageAt('', DURING)).toBe(-1)
    expect(ageAt('11/09/2008', DURING)).toBe(-1)
    expect(ageAt('2008-02-31', DURING)).toBe(-1)
  })

  /**
   * The concrete regression: it was computed in UTC. Someone turning 18 on
   * the 10th started counting as an adult from 18:00 on the 9th, local time —
   * six hours in which the system decided differently than the law.
   */
  it('resolves "today" in central Mexico time, not in UTC', () => {
    // September 9, 23:00 in Mexico = September 10, 05:00 UTC.
    const nightOfTheNinth = Date.parse('2026-09-10T05:00:00.000Z')
    expect(ageAt('2008-09-10', nightOfTheNinth)).toBe(17)
    expect(isUnderage('2008-09-10', nightOfTheNinth)).toBe(true)

    // One minute past midnight on the 10th, now in Mexico too.
    const earlyMorningOfTheTenth = Date.parse('2026-09-10T06:01:00.000Z')
    expect(ageAt('2008-09-10', earlyMorningOfTheTenth)).toBe(18)
    expect(isUnderage('2008-09-10', earlyMorningOfTheTenth)).toBe(false)
  })
})

describe('isUnderage', () => {
  it('treats an unreadable date as underage', () => {
    // The expensive mistake is the other one: taking someone for an adult
    // who is not and never asking them for their guardian's authorization.
    expect(isUnderage('basura', DURING)).toBe(true)
    expect(isUnderage('', DURING)).toBe(true)
  })
})

describe('isValidBirthDate', () => {
  it('accepts a reasonable date', () => {
    expect(isValidBirthDate('2008-09-10', DURING)).toBe(true)
  })

  it('rejects the future, the implausible, and the malformed', () => {
    expect(isValidBirthDate('2027-01-01', DURING)).toBe(false)
    expect(isValidBirthDate('1899-01-01', DURING)).toBe(false)
    expect(isValidBirthDate('2008-13-01', DURING)).toBe(false)
    expect(isValidBirthDate('2008-02-30', DURING)).toBe(false)
    expect(isValidBirthDate('10-09-2008', DURING)).toBe(false)
  })
})
