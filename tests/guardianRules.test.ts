import { describe, expect, it } from 'vitest'
import {
  GUARDIAN_NAME_LIMIT,
  checkGuardianEmail,
  checkGuardianName,
  validateBirthDateDeclaration,
} from '../convex/lib/guardianRules'

/** 2026-08-27. A 2005 birth date is an adult, a 2012 one is a minor. */
const NOW = Date.parse('2026-08-27T12:00:00.000Z')
const ADULT = '2005-04-11'
const MINOR = '2012-04-11'

describe('validateBirthDateDeclaration', () => {
  it('accepts an adult with no guardian details', () => {
    expect(validateBirthDateDeclaration({ birthDate: ADULT }, NOW)).toEqual([])
  })

  it('ignores guardian details for an adult', () => {
    const errors = validateBirthDateDeclaration(
      { birthDate: ADULT, guardianName: '', guardianEmail: 'nope' },
      NOW,
    )
    expect(errors).toEqual([])
  })

  it('requires guardian details for a minor', () => {
    const errors = validateBirthDateDeclaration({ birthDate: MINOR }, NOW)
    expect(errors.map((e) => e.code)).toEqual([
      'guardian_name_required',
      'guardian_email_invalid',
    ])
  })

  it('accepts a minor with valid guardian details', () => {
    const errors = validateBirthDateDeclaration(
      { birthDate: MINOR, guardianName: 'Rosa Gómez', guardianEmail: 'rosa@example.com' },
      NOW,
    )
    expect(errors).toEqual([])
  })

  it('rejects a missing birth date', () => {
    expect(validateBirthDateDeclaration({ birthDate: '' }, NOW)[0].code).toBe(
      'birth_date_required',
    )
  })

  it('rejects a future birth date', () => {
    expect(validateBirthDateDeclaration({ birthDate: '2030-01-01' }, NOW)[0].code).toBe(
      'birth_date_future',
    )
  })

  /**
   * The hole this whole module exists to close. Without it a minor puts their
   * own address in as their guardian's and authorizes themselves, which is
   * exactly what the age gate is there to prevent.
   */
  it("rejects a guardian email equal to the registrant's own", () => {
    const errors = validateBirthDateDeclaration(
      {
        birthDate: MINOR,
        guardianName: 'Rosa Gómez',
        guardianEmail: 'ANA@example.com',
        ownEmail: 'ana@Example.com  ',
      },
      NOW,
    )
    expect(errors).toEqual([{ field: 'guardianEmail', code: 'guardian_email_same_as_own' }])
  })

  it('rejects an over-long guardian name', () => {
    const errors = validateBirthDateDeclaration(
      {
        birthDate: MINOR,
        guardianName: 'R'.repeat(GUARDIAN_NAME_LIMIT + 1),
        guardianEmail: 'rosa@example.com',
      },
      NOW,
    )
    expect(errors[0].code).toBe('guardian_name_too_long')
  })
})

describe('checkGuardianName', () => {
  it.each([
    ['Rosa Gómez', undefined],
    ['', 'guardian_name_required'],
    ['   ', 'guardian_name_required'],
  ])('%s -> %s', (input, expected) => {
    expect(checkGuardianName(input)).toBe(expected)
  })
})

describe('checkGuardianEmail', () => {
  it.each([
    ['rosa@example.com', undefined, undefined],
    ['', undefined, 'guardian_email_invalid'],
    ['rosa@', undefined, 'guardian_email_invalid'],
    ['ana@example.com', 'ana@example.com', 'guardian_email_same_as_own'],
    ['  ANA@EXAMPLE.COM ', 'ana@example.com', 'guardian_email_same_as_own'],
  ])('%s (own %s) -> %s', (input, own, expected) => {
    expect(checkGuardianEmail(input, own)).toBe(expected)
  })
})
