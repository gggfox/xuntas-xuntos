import { describe, expect, it } from 'vitest'
import { computeProgress } from '../src/lib/registrationProgress'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import type { RegistrationData } from '../convex/lib/registrationSchema'

/** Fills every field the bar counts. */
function complete(): RegistrationData {
  const d = emptyRegistration({
    name: 'Ana',
    email: 'ana@example.com',
    whatsapp: '5512345678',
    birthDate: '2008-04-11',
    branch: 'womens',
    cityState: 'Monterrey',
  })
  d.academic.school = 'ITESM'
  d.academic.grade = '11'
  d.athletic.club = 'Campestre'
  d.athletic.coach = 'L. Ruiz'
  d.athletic.ghin = '4.2'
  d.results = [{ tournament: 'CNIJ', result: '2º' }]
  d.motivationLetter = 'Quiero jugar.'
  d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
  return d
}

describe('computeProgress', () => {
  it('is 0 for an untouched form', () => {
    expect(computeProgress(emptyRegistration())).toBe(0)
  })

  it('is 100 when every counted field is filled', () => {
    expect(computeProgress(complete())).toBe(100)
  })

  it('rises as fields are filled', () => {
    const d = emptyRegistration()
    const before = computeProgress(d)
    d.personal.name = 'Ana'
    expect(computeProgress(d)).toBeGreaterThan(before)
  })

  it('does not count whitespace as an answer', () => {
    const d = emptyRegistration()
    d.personal.name = '   '
    expect(computeProgress(d)).toBe(0)
  })

  /** A half-filled row is not a result, so the bar must not credit it. */
  it('counts a results row only when both cells are filled', () => {
    const d = emptyRegistration()
    d.results = [{ tournament: 'CNIJ', result: '' }]
    expect(computeProgress(d)).toBe(0)
  })

  it('never exceeds 100', () => {
    expect(computeProgress(complete())).toBeLessThanOrEqual(100)
  })
})
