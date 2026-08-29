import type { RegistrationData } from './registrationSchema'

/**
 * What the reader had already done before the form opened.
 *
 * All three are true by the time the form can render — the panel will not
 * show it otherwise — so as arithmetic this is a constant, and saying so
 * plainly is better than pretending otherwise. It is here because the bar is
 * a message, not a measurement: someone who has made an account, confirmed
 * their address and given their date of birth has started, and opening them
 * at nothing says they have not.
 */
export type AccountMilestones = {
  /** There is an account. */
  created: boolean
  emailVerified: boolean
  /** A date of birth on the account, which is what decides the guardian path. */
  ageDeclared: boolean
}

/**
 * Approximate progress, only for the bar. It is not the validation: it counts
 * whether a field was answered, not whether the answer is any good, so the bar
 * can read 100% on a form that still fails to submit.
 */
export function computeProgress(d: RegistrationData, account: AccountMilestones): number {
  const slots = [
    account.created,
    account.emailVerified,
    account.ageDeclared,
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
    d.results.some((r) => r.tournament && r.result),
    d.motivationLetter,
    d.confirmations.rules,
    d.confirmations.scholarshipUnderstood,
    d.confirmations.privacy,
  ]
  const filled = slots.filter((c) =>
    typeof c === 'boolean' ? c : String(c).trim(),
  ).length
  return Math.round((filled / slots.length) * 100)
}
