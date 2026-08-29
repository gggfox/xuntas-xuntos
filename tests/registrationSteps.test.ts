import { describe, expect, it } from 'vitest'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import type { RegistrationData } from '../convex/lib/registrationSchema'
import { LETTER_MIN } from '../convex/lib/registrationRules'
import {
  clampStep,
  firstIncompleteStep,
  firstStepWithError,
  stepErrors,
  stepOfField,
  type StepFields,
} from '../src/lib/registrationSteps'

/**
 * The real membership list, copied rather than imported: these are node tests
 * and the source of truth sits next to the components. A component test
 * asserts the two agree, which is the half that has to be checked by
 * machine — this half only has to be a faithful eight-step shape.
 */
const STEPS: StepFields = [
  [
    'personal.name',
    'personal.email',
    'personal.whatsapp',
    'personal.birthDate',
    'personal.branch',
    'personal.cityState',
  ],
  ['academic.school', 'academic.grade', 'academic.graduationYear'],
  ['athletic.club', 'athletic.coach', 'athletic.ghin'],
  ['results'],
  [],
  [],
  ['motivationLetter'],
  ['confirmations.rules', 'confirmations.scholarshipUnderstood', 'confirmations.privacy'],
]

function validRegistration(): RegistrationData {
  const d = emptyRegistration({
    name: 'Ana Gómez',
    email: 'ana@example.com',
    whatsapp: '+52 55 1234 5678',
    birthDate: '2008-04-11',
    branch: 'womens',
    cityState: 'Monterrey, NL',
  })
  d.academic = { school: 'ITESM', grade: '11', graduationYear: '2027', interest: '' }
  d.athletic = { club: 'Club Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true }
  d.results = [{ tournament: 'CNIJ', result: '2º' }]
  d.motivationLetter = 'x'.repeat(Math.max(LETTER_MIN, 1))
  d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
  return d
}

describe('stepOfField', () => {
  it('finds the step a field is rendered on', () => {
    expect(stepOfField(STEPS, 'personal.name')).toBe(0)
    expect(stepOfField(STEPS, 'motivationLetter')).toBe(6)
    expect(stepOfField(STEPS, 'confirmations.privacy')).toBe(7)
  })

  /** A rejection of the whole submission is on no step, and must stay that way. */
  it('places the form-wide error nowhere', () => {
    expect(stepOfField(STEPS, 'form')).toBeNull()
  })
})

describe('stepErrors', () => {
  it('keeps only what belongs to the step asked about', () => {
    const errors = [
      { field: 'personal.name', code: 'name_required' },
      { field: 'academic.school', code: 'school_required' },
    ] as const
    expect(stepErrors(STEPS, 0, errors).map((e) => e.field)).toEqual(['personal.name'])
    expect(stepErrors(STEPS, 1, errors).map((e) => e.field)).toEqual(['academic.school'])
    expect(stepErrors(STEPS, 4, errors)).toEqual([])
  })

  it('answers for a step that does not exist rather than throwing', () => {
    expect(stepErrors(STEPS, 99, [{ field: 'personal.name', code: 'name_required' }])).toEqual([])
  })
})

describe('firstStepWithError', () => {
  /**
   * By position, not by the order the errors arrived in. The rules report in
   * document order today and this does not lean on that continuing.
   */
  it('takes the earliest step, whatever order the errors came in', () => {
    const errors = [
      { field: 'confirmations.privacy', code: 'confirm_privacy_required' },
      { field: 'personal.email', code: 'email_invalid' },
    ] as const
    expect(firstStepWithError(STEPS, errors)).toBe(0)
  })

  it('ignores a form-wide error that belongs to no step', () => {
    expect(firstStepWithError(STEPS, [{ field: 'form', code: 'window_closed' }])).toBeNull()
  })

  it('is null when there is nothing wrong', () => {
    expect(firstStepWithError(STEPS, [])).toBeNull()
  })
})

describe('firstIncompleteStep', () => {
  it('opens an untouched form on the first step', () => {
    expect(firstIncompleteStep(STEPS, emptyRegistration())).toBe(0)
  })

  it('skips past the steps already filled in', () => {
    const d = validRegistration()
    d.motivationLetter = ''
    expect(firstIncompleteStep(STEPS, d)).toBe(6)
  })

  /** Coming back to a finished draft means coming back to send it. */
  it('opens a complete draft on the last step, where the submit button is', () => {
    expect(firstIncompleteStep(STEPS, validRegistration())).toBe(7)
  })
})

describe('clampStep', () => {
  it('honours a step the reader has legitimately reached', () => {
    const d = validRegistration()
    d.motivationLetter = ''
    expect(clampStep(3, STEPS, d)).toBe(3)
  })

  /**
   * The gate on "next" would mean nothing if a hand-typed `?paso=8` walked
   * around it.
   */
  it('refuses to let a URL jump past the first unfilled step', () => {
    expect(clampStep(7, STEPS, emptyRegistration())).toBe(0)
  })

  it('pulls nonsense back inside the form', () => {
    const d = validRegistration()
    expect(clampStep(-4, STEPS, d)).toBe(0)
    expect(clampStep(999, STEPS, d)).toBe(7)
    expect(clampStep(2.7, STEPS, d)).toBe(2)
  })
})
