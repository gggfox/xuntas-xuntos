import type { RegistrationData } from './registrationSchema'

/**
 * Approximate progress, only for the bar. It is not the validation: it counts
 * whether a field was answered, not whether the answer is any good, so the bar
 * can read 100% on a form that still fails to submit.
 */
export function computeProgress(d: RegistrationData): number {
  const fields = [
    d.personal.name,
    d.personal.email,
    d.personal.whatsapp,
    d.personal.birthDate,
    d.personal.branch,
    d.personal.cityState,
    d.academic.school,
    d.academic.grade,
    d.athletic.club,
    d.athletic.coach,
    d.athletic.ghin,
    d.results.some((r) => r.tournament && r.result) ? 'x' : '',
    d.motivationLetter,
    d.confirmations.rules ? 'x' : '',
    d.confirmations.scholarshipUnderstood ? 'x' : '',
    d.confirmations.privacy ? 'x' : '',
  ]
  const filled = fields.filter((c) => String(c).trim()).length
  return Math.round((filled / fields.length) * 100)
}
