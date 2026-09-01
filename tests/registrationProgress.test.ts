import { describe, expect, it } from 'vitest'
import { computeProgress } from '../src/lib/registrationProgress'
import type { AccountMilestones } from '../src/lib/registrationProgress'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import type { RegistrationData } from '../convex/lib/registrationSchema'

/** What the panel passes: by the time the form renders, all three are true. */
const SIGNED_UP: AccountMilestones = { created: true, emailVerified: true, ageDeclared: true }

/** Nobody sees this, but it isolates the field half of the count. */
const NOBODY: AccountMilestones = { created: false, emailVerified: false, ageDeclared: false }

/** Fills every field the bar counts. */
function complete(): RegistrationData {
  const d = emptyRegistration({
    name: 'Ana',
    email: 'ana@example.com',
    whatsapp: '5512345678',
    birthDate: '2008-04-11',
    branch: 'womens',
    state: 'Nuevo León',
    city: 'Monterrey',
  })
  d.academic.school = 'ITESM'
  d.academic.grade = '11'
  d.athletic.club = 'Campestre'
  d.athletic.coach = 'L. Ruiz'
  d.athletic.ghin = '4.2'
  d.results = [{ tournament: 'CNIJ', result: '2\u00ba' }]
  d.rankings = [{ name: 'CNIJ', position: '12' }]
  d.motivationLetter = 'Quiero jugar.'
  d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
  return d
}

describe('computeProgress', () => {
  it('is 100 when every counted field is filled', () => {
    expect(computeProgress(complete(), SIGNED_UP)).toBe(100)
  })

  it('rises as fields are filled', () => {
    const d = emptyRegistration()
    const before = computeProgress(d, SIGNED_UP)
    d.personal.name = 'Ana'
    expect(computeProgress(d, SIGNED_UP)).toBeGreaterThan(before)
  })

  it('does not count whitespace as an answer', () => {
    const d = emptyRegistration()
    d.personal.name = '   '
    expect(computeProgress(d, NOBODY)).toBe(0)
  })

  /** A half-filled row is not a result, so the bar must not credit it. */
  it('counts a results row only when both cells are filled', () => {
    const d = emptyRegistration()
    d.results = [{ tournament: 'CNIJ', result: '' }]
    expect(computeProgress(d, NOBODY)).toBe(0)
  })

  it('never exceeds 100', () => {
    expect(computeProgress(complete(), SIGNED_UP)).toBeLessThanOrEqual(100)
  })
})

/**
 * Making an account, confirming an address and giving a date of birth are
 * things the reader actually did, and the bar used to open at nothing as
 * though they had not. The panel only renders the form once all three are
 * true, so this is a floor rather than a variable — that is the point of it.
 */
describe('the account counts towards the bar', () => {
  it('never opens an untouched form at nothing', () => {
    expect(computeProgress(emptyRegistration(), SIGNED_UP)).toBeGreaterThan(0)
  })

  it('credits each milestone separately', () => {
    const d = emptyRegistration()
    const none = computeProgress(d, NOBODY)
    const one = computeProgress(d, { ...NOBODY, created: true })
    const all = computeProgress(d, SIGNED_UP)
    expect(none).toBe(0)
    expect(one).toBeGreaterThan(none)
    expect(all).toBeGreaterThan(one)
  })

  it('still reaches 100 without leaving room the account cannot fill', () => {
    expect(computeProgress(complete(), SIGNED_UP)).toBe(100)
    expect(computeProgress(complete(), NOBODY)).toBeLessThan(100)
  })
})
