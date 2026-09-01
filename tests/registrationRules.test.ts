import { describe, expect, it } from 'vitest'
import { emptyRegistration, LETTER_LIMIT } from '../convex/lib/registrationSchema'
import { MEXICAN_STATES } from '../convex/lib/mexicanStates'
import type { RegistrationData } from '../convex/lib/registrationSchema'
import {
  LETTER_MIN,
  RANKINGS_MIN,
  RESULTS_MIN,
  checkBirthDate,
  checkEmail,
  checkGraduationYear,
  checkLetter,
  checkName,
  checkRankings,
  checkResults,
  checkState,
  checkWhatsapp,
  toErrorMap,
  validateRegistration,
} from '../convex/lib/registrationRules'

/** `n` complete result rows, distinct enough to read in a failure message. */
function filledResults(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    tournament: `Torneo ${i + 1}`,
    result: `${i + 1}º`,
  }))
}

/** A registration that passes every rule. The base for one-field mutations. */
function validRegistration(): RegistrationData {
  const d = emptyRegistration({
    name: 'Ana Gómez',
    email: 'ana@example.com',
    whatsapp: '+52 55 1234 5678',
    birthDate: '2008-04-11',
    branch: 'womens',
    state: 'Nuevo León',
    city: 'Monterrey',
  })
  d.academic = { school: 'ITESM', grade: '11', graduationYear: '2027', interest: 'Biología' }
  d.athletic = { club: 'Club Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true }
  d.results = filledResults(RESULTS_MIN)
  d.rankings = [{ name: 'CNIJ', position: '12' }]
  d.motivationLetter = 'x'.repeat(Math.max(LETTER_MIN, 1))
  d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
  return d
}

describe('validateRegistration', () => {
  it('accepts a complete registration', () => {
    expect(validateRegistration(validRegistration())).toEqual([])
  })

  it('reports errors in document order', () => {
    const d = emptyRegistration()
    const fields = validateRegistration(d).map((e) => e.field)
    expect(fields[0]).toBe('personal.name')
    expect(fields).toContain('confirmations.privacy')
    expect(fields.indexOf('personal.name')).toBeLessThan(fields.indexOf('academic.school'))
  })

  it('keys errors by the field path TanStack Form uses', () => {
    const d = validRegistration()
    d.personal.email = 'not-an-email'
    expect(toErrorMap(validateRegistration(d))).toEqual({ 'personal.email': 'email_invalid' })
  })

  it('rejects a branch that is neither womens nor mens', () => {
    const d = validRegistration()
    d.personal.branch = '' as RegistrationData['personal']['branch']
    expect(toErrorMap(validateRegistration(d))['personal.branch']).toBe('branch_required')
  })

  it('rejects a state that is not one of the 32', () => {
    const d = validRegistration()
    d.personal.state = 'Nueva York'
    expect(toErrorMap(validateRegistration(d))['personal.state']).toBe('state_required')
  })

  it('reports an empty city apart from an empty state', () => {
    const d = validRegistration()
    d.personal.state = ''
    d.personal.city = '   '
    const map = toErrorMap(validateRegistration(d))
    expect(map['personal.state']).toBe('state_required')
    expect(map['personal.city']).toBe('city_required')
  })

  it('requires RESULTS_MIN fully filled result rows', () => {
    const d = validRegistration()
    d.results = filledResults(RESULTS_MIN - 1)
    expect(toErrorMap(validateRegistration(d)).results).toBe('results_required')
  })

  it('does not credit a half-filled result row towards the minimum', () => {
    const d = validRegistration()
    d.results = [...filledResults(RESULTS_MIN - 1), { tournament: 'Solo torneo', result: '  ' }]
    expect(toErrorMap(validateRegistration(d)).results).toBe('results_required')
  })

  it('requires a ranking with a position', () => {
    const d = validRegistration()
    // What `emptyRegistration` seeds: the four names, no positions.
    d.rankings = [{ name: 'CNIJ', position: '' }, { name: 'WAGR', position: '   ' }]
    expect(toErrorMap(validateRegistration(d)).rankings).toBe('rankings_required')
  })

  it('accepts a position given only on the free-form ranking row', () => {
    const d = validRegistration()
    d.rankings = [{ name: 'CNIJ', position: '' }, { name: 'Ranking estatal', position: '3' }]
    expect(toErrorMap(validateRegistration(d)).rankings).toBeUndefined()
  })

  it('reports each unchecked confirmation separately', () => {
    const d = validRegistration()
    d.confirmations = { rules: false, scholarshipUnderstood: false, privacy: false }
    const map = toErrorMap(validateRegistration(d))
    expect(map['confirmations.rules']).toBe('confirm_rules_required')
    expect(map['confirmations.scholarshipUnderstood']).toBe('confirm_scholarship_required')
    expect(map['confirmations.privacy']).toBe('confirm_privacy_required')
  })
})

describe('checkState', () => {
  it.each([
    ['Nuevo León', undefined],
    ['  Ciudad de México  ', undefined],
    ['', 'state_required'],
    ['Nuevo Leon', 'state_required'],
    ['nuevo león', 'state_required'],
  ])('%j -> %s', (value, expected) => {
    expect(checkState(value)).toBe(expected)
  })

  it('offers every federal entity, once', () => {
    expect(MEXICAN_STATES).toHaveLength(32)
    expect(new Set(MEXICAN_STATES).size).toBe(32)
  })
})

describe('checkName', () => {
  it.each([
    ['Ana', undefined],
    ['  ', 'name_required'],
    ['A', 'name_too_short'],
  ])('%s -> %s', (input, expected) => {
    expect(checkName(input)).toBe(expected)
  })
})

describe('checkEmail', () => {
  it.each([
    ['ana@example.com', undefined],
    ['  Ana@Example.COM  ', undefined],
    ['', 'email_invalid'],
    ['ana@', 'email_invalid'],
    ['ana example.com', 'email_invalid'],
    ['ana@example', 'email_invalid'],
  ])('%s -> %s', (input, expected) => {
    expect(checkEmail(input)).toBe(expected)
  })
})

describe('checkWhatsapp', () => {
  it.each([
    ['5512345678', undefined],
    ['+52 55 1234 5678', undefined],
    ['(55) 1234-5678', undefined],
    ['', 'whatsapp_invalid'],
    ['12345', 'whatsapp_invalid'],
    ['no soy un teléfono', 'whatsapp_invalid'],
  ])('%s -> %s', (input, expected) => {
    expect(checkWhatsapp(input)).toBe(expected)
  })
})

describe('checkBirthDate', () => {
  const now = Date.parse('2026-08-27T12:00:00.000Z')

  it.each([
    ['2008-04-11', undefined],
    ['', 'birth_date_required'],
    ['2030-01-01', 'birth_date_future'],
    ['1899-01-01', 'birth_date_implausible'],
    ['2008-02-31', 'birth_date_implausible'],
    ['not-a-date', 'birth_date_implausible'],
  ])('%s -> %s', (input, expected) => {
    expect(checkBirthDate(input, now)).toBe(expected)
  })
})

describe('checkGraduationYear', () => {
  const now = Date.parse('2026-08-27T12:00:00.000Z')

  it.each([
    ['', undefined],
    [undefined, undefined],
    ['2027', undefined],
    ['2025', undefined],
    ['1990', 'graduation_year_invalid'],
    ['2099', 'graduation_year_invalid'],
    ['27', 'graduation_year_invalid'],
  ])('%s -> %s', (input, expected) => {
    expect(checkGraduationYear(input, now)).toBe(expected)
  })
})

describe('checkLetter', () => {
  it('rejects an empty letter', () => {
    expect(checkLetter('   ')).toBe('letter_required')
  })

  it('rejects a letter over the cap', () => {
    expect(checkLetter('x'.repeat(LETTER_LIMIT + 1))).toBe('letter_too_long')
  })

  it('accepts a letter within the limits', () => {
    expect(checkLetter('x'.repeat(Math.max(LETTER_MIN, 1)))).toBeUndefined()
  })

  /**
   * P4 is set to 0: XUNTAS would rather read a two-sentence letter than
   * reject anyone for brevity. Only the upper cap is enforced. Raising
   * LETTER_MIN turns the floor back on with no other edit.
   */
  it('accepts a terse letter, because the floor is off', () => {
    expect(LETTER_MIN).toBe(0)
    expect(checkLetter('Quiero jugar.')).toBeUndefined()
  })

  it('enforces the floor when it is set', () => {
    expect(checkLetter('short', 200)).toBe('letter_too_short')
  })
})

describe('checkResults', () => {
  it('counts only rows with both cells filled', () => {
    expect(checkResults(filledResults(RESULTS_MIN))).toBeUndefined()
    expect(checkResults(filledResults(RESULTS_MIN - 1))).toBe('results_required')
  })

  /** The floor is a parameter so a moved threshold does not need a new test. */
  it('takes the minimum as an argument', () => {
    expect(checkResults(filledResults(1), 1)).toBeUndefined()
    expect(checkResults(filledResults(1), 2)).toBe('results_required')
  })
})

describe('checkRankings', () => {
  it('wants RANKINGS_MIN rows carrying both a name and a position', () => {
    const seeded = [{ name: 'CNIJ', position: '' }]
    expect(checkRankings(seeded)).toBe('rankings_required')
    expect(checkRankings([{ name: 'CNIJ', position: '12' }])).toBeUndefined()
    expect(RANKINGS_MIN).toBeGreaterThan(0)
  })
})
