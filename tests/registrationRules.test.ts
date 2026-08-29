import { describe, expect, it } from 'vitest'
import { emptyRegistration, LETTER_LIMIT } from '../convex/lib/registrationSchema'
import type { RegistrationData } from '../convex/lib/registrationSchema'
import {
  LETTER_MIN,
  checkBirthDate,
  checkEmail,
  checkGraduationYear,
  checkLetter,
  checkName,
  checkWhatsapp,
  toErrorMap,
  validateRegistration,
} from '../convex/lib/registrationRules'

/** A registration that passes every rule. The base for one-field mutations. */
function validRegistration(): RegistrationData {
  const d = emptyRegistration({
    name: 'Ana Gómez',
    email: 'ana@example.com',
    whatsapp: '+52 55 1234 5678',
    birthDate: '2008-04-11',
    branch: 'womens',
    cityState: 'Monterrey, NL',
  })
  d.academic = { school: 'ITESM', grade: '11', graduationYear: '2027', interest: 'Biología' }
  d.athletic = { club: 'Club Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true }
  d.results = [{ tournament: 'CNIJ', result: '2º' }]
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

  it('requires at least one fully filled result row', () => {
    const d = validRegistration()
    d.results = [{ tournament: 'CNIJ', result: '' }]
    expect(toErrorMap(validateRegistration(d)).results).toBe('results_required')
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
