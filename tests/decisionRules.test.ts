import { describe, expect, it } from 'vitest'
import {
  SECTIONS_TOTAL,
  checkDecision,
  noticeDecisionFor,
  permissionFor,
  sectionsComplete,
} from '../convex/lib/decisionRules'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import type { RegistrationData } from '../convex/lib/registrationSchema'

const REVIEWER = ['review_registrations', 'send_rejection', 'view_staff'] as const
const MASTER = [
  'review_registrations', 'send_rejection', 'select_registrations',
  'send_batch', 'view_staff', 'manage_users', 'manage_cycles',
] as const

const base = { guardianConfirmed: true, noticeStatus: null, permissions: REVIEWER }

describe('permissionFor', () => {
  it('splits screening from selection', () => {
    expect(permissionFor('validated')).toBe('review_registrations')
    expect(permissionFor('rejected')).toBe('review_registrations')
    expect(permissionFor('selected')).toBe('select_registrations')
    expect(permissionFor('not_selected')).toBe('select_registrations')
  })
})

describe('checkDecision', () => {
  it('lets a reviewer validate a submitted registration', () => {
    expect(checkDecision({ ...base, from: 'submitted', to: 'validated' })).toBeNull()
  })

  it('never decides a draft', () => {
    expect(checkDecision({ ...base, from: 'draft', to: 'validated' })).toBe('decision_invalid')
  })

  it('wants a note on every rejection', () => {
    expect(checkDecision({ ...base, from: 'submitted', to: 'rejected' })).toBe('note_required')
    expect(checkDecision({ ...base, from: 'submitted', to: 'rejected', note: '  ' })).toBe('note_required')
    expect(checkDecision({ ...base, from: 'submitted', to: 'rejected', note: 'Fuera de edad.' })).toBeNull()
  })

  it('wants a note when a prior decision changes', () => {
    expect(checkDecision({ ...base, from: 'validated', to: 'rejected', note: 'x' })).toBeNull()
    expect(checkDecision({ ...base, from: 'rejected', to: 'validated' })).toBe('note_required')
  })

  it('needs select_registrations to select, and only from validated', () => {
    expect(checkDecision({ ...base, from: 'validated', to: 'selected' })).toBe('permission_required')
    expect(checkDecision({ ...base, permissions: MASTER, from: 'validated', to: 'selected' })).toBeNull()
    expect(checkDecision({ ...base, permissions: MASTER, from: 'submitted', to: 'selected' })).toBe('decision_invalid')
  })

  /** DECISIONS open item 2, closed: validate yes, select never, without the guardian. */
  it('lets a guardian-pending registration be validated but not selected', () => {
    expect(checkDecision({ ...base, guardianConfirmed: false, from: 'submitted', to: 'validated' })).toBeNull()
    expect(
      checkDecision({ ...base, permissions: MASTER, guardianConfirmed: false, from: 'validated', to: 'selected' }),
    ).toBe('guardian_unconfirmed')
  })

  it('locks a decision once its notice went out, except for a master admin with a note', () => {
    expect(checkDecision({ ...base, noticeStatus: 'sent', from: 'rejected', to: 'validated', note: 'x' })).toBe(
      'decision_locked',
    )
    expect(
      checkDecision({ ...base, permissions: MASTER, noticeStatus: 'sent', from: 'rejected', to: 'validated' }),
    ).toBe('note_required')
    expect(
      checkDecision({ ...base, permissions: MASTER, noticeStatus: 'delivered', from: 'rejected', to: 'validated', note: 'x' }),
    ).toBeNull()
  })

  it('treats not_sent as not locked', () => {
    expect(checkDecision({ ...base, noticeStatus: 'not_sent', from: 'rejected', to: 'validated', note: 'x' })).toBeNull()
  })

  it('wants a note for a reversal out of selection', () => {
    expect(checkDecision({ ...base, permissions: MASTER, from: 'selected', to: 'validated' })).toBe('note_required')
    expect(checkDecision({ ...base, permissions: MASTER, from: 'selected', to: 'validated', note: 'x' })).toBeNull()
  })

  it('wants a note when the Council reverses itself', () => {
    expect(checkDecision({ ...base, permissions: MASTER, from: 'not_selected', to: 'selected' })).toBe('note_required')
  })

  it('wants a note when a selection is pulled all the way back to rejected', () => {
    expect(checkDecision({ ...base, permissions: MASTER, from: 'not_selected', to: 'rejected' })).toBe('note_required')
  })

  it('locks validated → selected too, once the notice is out — a note is not optional here', () => {
    expect(
      checkDecision({
        permissions: MASTER,
        guardianConfirmed: true,
        noticeStatus: 'sent',
        from: 'validated',
        to: 'selected',
      }),
    ).toBe('note_required')
  })

  it('still asks nothing extra for validated → selected while unlocked', () => {
    expect(checkDecision({ ...base, permissions: MASTER, from: 'validated', to: 'selected' })).toBeNull()
  })
})

describe('noticeDecisionFor', () => {
  it('maps the three states that get an email, and nothing else', () => {
    expect(noticeDecisionFor('rejected')).toBe('rejected')
    expect(noticeDecisionFor('selected')).toBe('selected')
    expect(noticeDecisionFor('not_selected')).toBe('not_selected')
    expect(noticeDecisionFor('validated')).toBeNull()
    expect(noticeDecisionFor('submitted')).toBeNull()
  })
})

describe('sectionsComplete', () => {
  function complete(): RegistrationData {
    const d = emptyRegistration({
      name: 'Ana Gómez', email: 'ana@example.com', whatsapp: '5512345678',
      birthDate: '2008-04-11', branch: 'womens', state: 'Nuevo León', city: 'Monterrey',
    })
    d.academic.school = 'ITESM'
    d.academic.grade = '11'
    d.athletic = { club: 'Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true }
    d.results = [1, 2, 3, 4].map((i) => ({ tournament: `T${i}`, result: '1' }))
    d.rankings = [{ name: 'CNIJ', position: '12' }]
    d.motivationLetter = 'Quiero jugar.'
    d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
    return d
  }

  it('is 7 of 7 for a registration that passes every rule', () => {
    expect(SECTIONS_TOTAL).toBe(7)
    expect(sectionsComplete(complete())).toBe(7)
  })

  it('is 0 for an empty one', () => {
    expect(sectionsComplete(emptyRegistration())).toBe(0)
  })

  it('counts a section only when its rules pass, not when it has text', () => {
    const d = complete()
    d.results = [{ tournament: 'Solo uno', result: '1' }] // rules want four
    expect(sectionsComplete(d)).toBe(6)
  })

  it('ignores the calendar: an optional step cannot be owed', () => {
    const d = complete()
    d.calendar = []
    expect(sectionsComplete(d)).toBe(7)
  })
})
