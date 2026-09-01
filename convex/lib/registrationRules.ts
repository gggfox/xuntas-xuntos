import type { AppErrorCode, FieldErrorCode } from './errorCodes'
import { LETTER_LIMIT, type RegistrationData } from './registrationSchema'
import { isValidBirthDate } from './cycle'
import { isMexicanState } from './mexicanStates'

/**
 * Validation for a registration, as pure functions returning codes.
 *
 * This module is the source of truth. `convex/registrations.ts` calls it
 * before writing, and the browser calls it through
 * `src/lib/registrationRules.ts` for immediate feedback. They cannot drift
 * because there is only one of them.
 *
 * It imports nothing from Convex and nothing from Paraglide, so it runs in a
 * plain Node test.
 */

// --- thresholds -------------------------------------------------------------
// Product decisions, not technical ones. See "Open decisions" in the design
// doc: each is one constant precisely so XUNTAS can move it in one line.

/** P1 — a single stray character is not a name. */
export const NAME_MIN = 2

/** P2 — Mexican mobile numbers are 10 digits. Separators are stripped first. */
export const WHATSAPP_MIN_DIGITS = 10

/** P3 — someone who already graduated, through someone starting secondary. */
export const GRADUATION_YEARS_BACK = 1
export const GRADUATION_YEARS_AHEAD = 12

/**
 * P4 — minimum letter length. Off.
 *
 * The brief asks for "one page at most, written by you". A floor set too high
 * turns a terse but genuine letter into an error, and XUNTAS would rather
 * read two sentences than reject anyone for brevity. Only the upper cap
 * (`LETTER_LIMIT`) is enforced. Raising this number turns the floor back on
 * and `letter_too_short` starts being reachable again; nothing else changes.
 */
export const LETTER_MIN = 0

/**
 * P5 — how many complete result rows a record has to show.
 *
 * A season is not one tournament. The panel reads step 4 to judge how much a
 * player competes, and a single row says nothing either way, so the form asks
 * for four before it will move on. The form seeds exactly this many blank
 * rows, which is what makes the ask legible without a sentence explaining it.
 */
export const RESULTS_MIN = 4

/**
 * P6 — how many rankings, with a position, are required.
 *
 * Rankings used to be entirely optional. One is now the floor: every player
 * the convocatoria is addressed to appears in at least one of the four lists,
 * and the free-form row catches anyone who appears only in a fifth.
 */
export const RANKINGS_MIN = 1

// --- field paths ------------------------------------------------------------

/**
 * Dotted paths, matching the `name` TanStack Form gives each field, so a
 * validation result maps straight onto the form without translation.
 */
export type RegistrationFieldPath =
  | 'personal.name'
  | 'personal.email'
  | 'personal.whatsapp'
  | 'personal.birthDate'
  | 'personal.branch'
  | 'personal.state'
  | 'personal.city'
  | 'academic.school'
  | 'academic.grade'
  | 'academic.graduationYear'
  | 'athletic.club'
  | 'athletic.coach'
  | 'athletic.ghin'
  | 'results'
  | 'rankings'
  | 'motivationLetter'
  | 'confirmations.rules'
  | 'confirmations.scholarshipUnderstood'
  | 'confirmations.privacy'
  /**
   * Not a field. It is what a rejection of the whole action attaches to — the
   * window closed, the registration was already reviewed — so such an error
   * can ride in the same list instead of needing a second channel.
   */
  | 'form'

export type RegistrationError = {
  field: RegistrationFieldPath
  /**
   * `AppErrorCode`, not `FieldErrorCode`: the rules only ever produce field
   * codes, but `submit` returns action codes in this same shape.
   */
  code: AppErrorCode
}

// --- field rules ------------------------------------------------------------
// Each returns `undefined` when the value is acceptable. That is the shape
// TanStack Form wants from a field validator.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function checkName(value: string): FieldErrorCode | undefined {
  const v = value.trim()
  if (!v) return 'name_required'
  if (v.length < NAME_MIN) return 'name_too_short'
  return undefined
}

export function checkEmail(value: string): FieldErrorCode | undefined {
  return EMAIL_RE.test(value.trim()) ? undefined : 'email_invalid'
}

/**
 * Counts digits, having thrown away the punctuation people actually type.
 * `+52 55 1234 5678` and `(55) 1234-5678` are the same number.
 */
export function checkWhatsapp(value: string): FieldErrorCode | undefined {
  const digits = value.replace(/\D/g, '')
  return digits.length >= WHATSAPP_MIN_DIGITS ? undefined : 'whatsapp_invalid'
}

export function checkBirthDate(value: string, now: number = Date.now()): FieldErrorCode | undefined {
  const v = value.trim()
  if (!v) return 'birth_date_required'
  // `isValidBirthDate` folds "not a real date", "in the future" and "before
  // 1930" into one boolean. Split them so the message can be specific.
  if (isValidBirthDate(v, now)) return undefined
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (parsed && Date.UTC(Number(parsed[1]), Number(parsed[2]) - 1, Number(parsed[3])) > now) {
    return 'birth_date_future'
  }
  return 'birth_date_implausible'
}

export function checkBranch(value: string): FieldErrorCode | undefined {
  return value === 'womens' || value === 'mens' ? undefined : 'branch_required'
}

/**
 * Membership, not merely non-empty: the field is a closed list of 32, so a
 * value from outside it did not come from the dropdown and there is no
 * reading of it that we should store.
 */
export function checkState(value: string): FieldErrorCode | undefined {
  return isMexicanState(value.trim()) ? undefined : 'state_required'
}

/** The shared shape of the six plain required text fields. */
export function checkRequiredText(
  value: string,
  code: FieldErrorCode,
): FieldErrorCode | undefined {
  return value.trim() ? undefined : code
}

export function checkGraduationYear(
  value: string | undefined,
  now: number = Date.now(),
): FieldErrorCode | undefined {
  const v = (value ?? '').trim()
  if (!v) return undefined // optional
  if (!/^\d{4}$/.test(v)) return 'graduation_year_invalid'
  const year = Number(v)
  const thisYear = new Date(now).getUTCFullYear()
  if (year < thisYear - GRADUATION_YEARS_BACK) return 'graduation_year_invalid'
  if (year > thisYear + GRADUATION_YEARS_AHEAD) return 'graduation_year_invalid'
  return undefined
}

/**
 * A row counts only when both cells are filled. Half a row is someone who
 * started typing and stopped, and crediting it would let the form pass on
 * work nobody finished.
 */
export function countFilledRows(rows: readonly { a: string; b: string }[]): number {
  return rows.filter((r) => r.a.trim() && r.b.trim()).length
}

export function checkResults(
  rows: RegistrationData['results'],
  min: number = RESULTS_MIN,
): FieldErrorCode | undefined {
  const filled = countFilledRows(rows.map((r) => ({ a: r.tournament, b: r.result })))
  return filled >= min ? undefined : 'results_required'
}

export function checkRankings(
  rows: RegistrationData['rankings'],
  min: number = RANKINGS_MIN,
): FieldErrorCode | undefined {
  const filled = countFilledRows(rows.map((r) => ({ a: r.name, b: r.position })))
  return filled >= min ? undefined : 'rankings_required'
}

/**
 * `min` is a parameter rather than a straight read of `LETTER_MIN` so the
 * floor can be exercised by a test while it is switched off in production.
 */
export function checkLetter(value: string, min: number = LETTER_MIN): FieldErrorCode | undefined {
  const v = value.trim()
  if (!v) return 'letter_required'
  if (min > 0 && v.length < min) return 'letter_too_short'
  if (value.length > LETTER_LIMIT) return 'letter_too_long'
  return undefined
}

// --- the whole form ---------------------------------------------------------

/**
 * Errors in document order, so the summary at the top of the form reads in
 * the same order as the form itself.
 */
export function validateRegistration(
  d: RegistrationData,
  now: number = Date.now(),
): RegistrationError[] {
  const errors: RegistrationError[] = []
  const push = (field: RegistrationFieldPath, code: FieldErrorCode | undefined) => {
    if (code) errors.push({ field, code })
  }

  push('personal.name', checkName(d.personal.name))
  push('personal.email', checkEmail(d.personal.email))
  push('personal.whatsapp', checkWhatsapp(d.personal.whatsapp))
  push('personal.birthDate', checkBirthDate(d.personal.birthDate, now))
  push('personal.branch', checkBranch(d.personal.branch))
  push('personal.state', checkState(d.personal.state))
  push('personal.city', checkRequiredText(d.personal.city, 'city_required'))

  push('academic.school', checkRequiredText(d.academic.school, 'school_required'))
  push('academic.grade', checkRequiredText(d.academic.grade, 'grade_required'))
  push('academic.graduationYear', checkGraduationYear(d.academic.graduationYear, now))

  push('athletic.club', checkRequiredText(d.athletic.club, 'club_required'))
  push('athletic.coach', checkRequiredText(d.athletic.coach, 'coach_required'))
  push('athletic.ghin', checkRequiredText(d.athletic.ghin, 'ghin_required'))

  push('results', checkResults(d.results))
  push('rankings', checkRankings(d.rankings))

  push('motivationLetter', checkLetter(d.motivationLetter))

  // Each box gets its own error. The old code pushed the box's LABEL as the
  // error text, so the list read as a set of statements rather than problems.
  if (!d.confirmations.rules) push('confirmations.rules', 'confirm_rules_required')
  if (!d.confirmations.scholarshipUnderstood) {
    push('confirmations.scholarshipUnderstood', 'confirm_scholarship_required')
  }
  if (!d.confirmations.privacy) push('confirmations.privacy', 'confirm_privacy_required')

  return errors
}

/** Lookup by field, for rendering an error next to its input. */
export function toErrorMap(
  errors: RegistrationError[],
): Partial<Record<RegistrationFieldPath, AppErrorCode>> {
  const map: Partial<Record<RegistrationFieldPath, AppErrorCode>> = {}
  for (const e of errors) map[e.field] ??= e.code
  return map
}
