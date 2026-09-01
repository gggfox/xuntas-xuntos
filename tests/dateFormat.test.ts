import { describe, expect, it } from 'vitest'
import { maskMonth, monthISOToText, textToMonthISO } from '../src/components/DateField/format'

/**
 * The month box of the competitive calendar. Unlike a date of birth there is
 * no `dayFirst` to honour: Spanish and English both write a bare month and
 * year as `10/2026`, so one shape serves both.
 */
describe('maskMonth', () => {
  it('slides a slash in after the month as the digits arrive', () => {
    expect(maskMonth('1')).toBe('1')
    expect(maskMonth('10')).toBe('10')
    expect(maskMonth('102')).toBe('10/2')
    expect(maskMonth('102026')).toBe('10/2026')
  })

  it('keeps only digits, however the reader typed the separator', () => {
    expect(maskMonth('10-2026')).toBe('10/2026')
    expect(maskMonth('10/2026')).toBe('10/2026')
  })

  it('stops at six digits', () => {
    expect(maskMonth('1020261234')).toBe('10/2026')
  })
})

describe('textToMonthISO', () => {
  it('reads a complete month', () => {
    expect(textToMonthISO('10/2026')).toBe('2026-10')
  })

  it('is null while the month is still being typed', () => {
    expect(textToMonthISO('')).toBeNull()
    expect(textToMonthISO('10/20')).toBeNull()
  })

  it('is null for a month that does not exist', () => {
    expect(textToMonthISO('00/2026')).toBeNull()
    expect(textToMonthISO('13/2026')).toBeNull()
  })
})

describe('monthISOToText', () => {
  it('prints the stored month for the box', () => {
    expect(monthISOToText('2026-10')).toBe('10/2026')
    expect(monthISOToText('2026-03')).toBe('03/2026')
  })

  it('is empty for anything that is not a month', () => {
    expect(monthISOToText('')).toBe('')
    expect(monthISOToText('2026-10-01')).toBe('')
  })
})
