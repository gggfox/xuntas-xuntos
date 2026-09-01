/**
 * Shape of a registration, and the two transforms that go with it.
 *
 * It lives in `convex/lib/` and is re-exported by `src/lib/` for the same
 * reason `cycle.ts` is: the client and the server must not be able to
 * disagree about what a registration is.
 */

export const LETTER_LIMIT = 3000

/** The four rankings XUNTAS follows. The fifth row is free-form. */
export const FIXED_RANKINGS = ['CNIJ', 'AJGA', 'Junior Scoreboard', 'WAGR'] as const

export type RegistrationData = {
  personal: {
    name: string
    email: string
    whatsapp: string
    birthDate: string
    branch: 'womens' | 'mens'
    state: string
    city: string
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

/**
 * Starts with four results and two events visible.
 *
 * Four because that is `RESULTS_MIN` in `registrationRules.ts`: the number of
 * blank rows is how the form says how many it wants, and a reader who fills
 * in what is in front of them has done enough. The count is not imported —
 * that would be a cycle, since the rules import this file — so a test in
 * `tests/registrationSchema.test.ts` holds the two together instead.
 */
export function emptyRegistration(seed?: Partial<RegistrationData['personal']>): RegistrationData {
  return {
    personal: {
      name: '',
      email: '',
      whatsapp: '',
      birthDate: '',
      branch: '' as 'womens' | 'mens',
      state: '',
      city: '',
      ...seed,
    },
    academic: { school: '', grade: '', graduationYear: '', interest: '' },
    athletic: { club: '', coach: '', ghin: '', amateurStatus: false },
    results: [
      { tournament: '', result: '' },
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
