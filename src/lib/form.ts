import * as m from '../paraglide/messages.js'

export const LETTER_LIMIT = 3000

/** The four rankings XUNTAS follows. The fifth row is free-form. */
export const FIXED_RANKINGS = ['CNIJ', 'AJGA', 'Junior Scoreboard', 'WAGR'] as const

export type Row = { a: string; b: string }

export type RegistrationData = {
  personal: {
    name: string
    email: string
    whatsapp: string
    birthDate: string
    branch: 'womens' | 'mens'
    cityState: string
  }
  academic: {
    school: string
    grade: string
    graduationYear?: string
    interest?: string
  }
  athletic: {
    club: string
    coach: string
    ghin: string
    amateurStatus: boolean
  }
  results: Array<{ tournament: string; result: string }>
  rankings: Array<{ name: string; position: string }>
  calendar: Array<{ event: string; date: string }>
  motivationLetter: string
  confirmations: {
    rules: boolean
    scholarshipUnderstood: boolean
    privacy: boolean
  }
}

export function emptyRow(): Row {
  return { a: '', b: '' }
}

/** Starts with three results and two events visible, like the prototype. */
export function emptyRegistration(seed?: Partial<RegistrationData['personal']>): RegistrationData {
  return {
    personal: {
      name: '',
      email: '',
      whatsapp: '',
      birthDate: '',
      branch: '' as 'womens' | 'mens',
      cityState: '',
      ...seed,
    },
    academic: { school: '', grade: '', graduationYear: '', interest: '' },
    athletic: { club: '', coach: '', ghin: '', amateurStatus: false },
    results: [
      { tournament: '', result: '' },
      { tournament: '', result: '' },
      { tournament: '', result: '' },
    ],
    rankings: FIXED_RANKINGS.map((name) => ({ name, position: '' })),
    calendar: [
      { event: '', date: '' },
      { event: '', date: '' },
    ],
    motivationLetter: '',
    confirmations: { rules: false, scholarshipUnderstood: false, privacy: false },
  }
}

/**
 * Client-side validation. It mirrors the server's (`convex/registrations.ts`)
 * to give quick feedback — the server's is the one in charge.
 */
export function validateRegistration(d: RegistrationData): string[] {
  const e: string[] = []

  if (!d.personal.name.trim()) e.push(m.reg_name_error())
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.personal.email)) e.push(m.reg_email_error())
  if (!d.personal.whatsapp.trim()) e.push(m.reg_whatsapp_error())
  if (!d.personal.birthDate) e.push(m.gate_date_error())
  if (d.personal.branch !== 'womens' && d.personal.branch !== 'mens') e.push(m.reg_branch_error())
  if (!d.personal.cityState.trim()) e.push(m.reg_city_error())

  if (!d.academic.school.trim()) e.push(m.reg_school_error())
  if (!d.academic.grade.trim()) e.push(m.reg_grade_error())

  if (!d.athletic.club.trim()) e.push(m.reg_club_error())
  if (!d.athletic.coach.trim()) e.push(m.reg_coach_error())
  if (!d.athletic.ghin.trim()) e.push(m.reg_ghin_error())

  if (!d.results.some((r) => r.tournament.trim() && r.result.trim())) {
    e.push(m.reg_results_error())
  }

  if (!d.motivationLetter.trim()) e.push(m.reg_letter_error())

  if (!d.confirmations.rules) e.push(m.reg_ck_rules())
  if (!d.confirmations.scholarshipUnderstood) e.push(m.reg_ck_scholarship())
  if (!d.confirmations.privacy) e.push(m.reg_ck_privacy())

  return e
}

/** Removes empty rows and normalizes before sending to the server. */
export function prepareForSubmit(d: RegistrationData): RegistrationData {
  return {
    ...d,
    personal: { ...d.personal, email: d.personal.email.trim().toLowerCase() },
    results: d.results.filter((r) => r.tournament.trim() && r.result.trim()),
    rankings: d.rankings.filter((r) => r.name.trim() && r.position.trim()),
    calendar: d.calendar.filter((c) => c.event.trim() && c.date.trim()),
  }
}
