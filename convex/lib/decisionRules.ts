import type { AppErrorCode } from './errorCodes'
import type { Permission } from './permissions'
import { validateRegistration, type RegistrationFieldPath } from './registrationRules'
import type { RegistrationData } from './registrationSchema'

/**
 * The decisions a registration can carry and who may make them. Two stages:
 * administration screens (`validated` / `rejected`), the Council — by a
 * master_admin's hand — selects (`selected` / `not_selected`). The acceptance
 * email is about selection, and sending "accepted" to two hundred screened
 * people who then do not make twenty-five is the worst email this system
 * could send.
 */

export type Decision = 'validated' | 'rejected' | 'selected' | 'not_selected'
export const DECISIONS: readonly Decision[] = ['validated', 'rejected', 'selected', 'not_selected']
export type RegistrationStatus = 'draft' | 'submitted' | Decision

export type NoticeDecision = 'rejected' | 'selected' | 'not_selected'
export type NoticeStatus = 'not_sent' | 'sent' | 'delivered' | 'bounced'

export function permissionFor(decision: Decision): Permission {
  return decision === 'validated' || decision === 'rejected'
    ? 'review_registrations'
    : 'select_registrations'
}

/** What may follow what. Changing a prior decision is allowed (with a note). */
const NEXT: Record<RegistrationStatus, readonly Decision[]> = {
  draft: [],
  submitted: ['validated', 'rejected'],
  validated: ['rejected', 'selected', 'not_selected'],
  rejected: ['validated'],
  selected: ['not_selected', 'validated', 'rejected'],
  not_selected: ['selected', 'validated', 'rejected'],
}

/**
 * Whether a status is one of the four decisions rather than `draft` or
 * `submitted`. Exported so every place that needs "has this already been
 * decided" — the draft-save and submit guards in `registrations.ts` included
 * — asks this function instead of re-listing the decided statuses itself.
 * `selected` and `not_selected` were added after those two call sites were
 * written and neither one was updated for them; a shared predicate is the
 * only way a status added later cannot repeat that gap.
 */
export const isDecided = (s: RegistrationStatus): s is Decision => s !== 'draft' && s !== 'submitted'

const isSelectionDecision = (d: RegistrationStatus): boolean => d === 'selected' || d === 'not_selected'

/**
 * Whether this transition overturns a decision that was already on record —
 * not merely a status that happens to be "decided". Screening and selection
 * are two separate decisions made by two separate people at two separate
 * times, so `validated → selected` is the *first* selection decision, not a
 * change to one; but `selected → not_selected` reverses one, and so does
 * leaving screening altogether (`selected → rejected`, `rejected →
 * validated`), which is why that case falls back to "was screening already
 * decided" rather than "was this exact decision already made".
 */
const changesAPriorDecision = (from: RegistrationStatus, to: Decision): boolean =>
  isSelectionDecision(to) ? isSelectionDecision(from) : isDecided(from)

export function checkDecision(input: {
  from: RegistrationStatus
  to: Decision
  note?: string
  guardianConfirmed: boolean
  noticeStatus: NoticeStatus | null
  permissions: readonly Permission[]
}): AppErrorCode | null {
  const { from, to } = input
  if (!NEXT[from].includes(to)) return 'decision_invalid'

  const locked = input.noticeStatus !== null && input.noticeStatus !== 'not_sent'
  // A sent notice is a promise made to a family. Only a master_admin may
  // unmake it, and only with a reason on file.
  //
  // Leaving a selection is also gated on `select_registrations`, even when
  // the destination (`validated`) would only need `review_registrations` on
  // its own: selection is the master_admin's authority, and a plain admin
  // walking a row back out of it erases that decision as surely as making
  // it, just without the ability to redo it.
  const needs: Permission = locked || isSelectionDecision(from) ? 'select_registrations' : permissionFor(to)
  if (!input.permissions.includes(needs)) {
    return locked ? 'decision_locked' : 'permission_required'
  }

  if (to === 'selected' && !input.guardianConfirmed) return 'guardian_unconfirmed'

  // `locked` is its own trigger, not folded into `changesAPriorDecision`:
  // once the notice went out, *any* further change to this decision needs a
  // reason on file, even a validated → selected that would otherwise be the
  // first, note-free selection decision. Without this the module would have
  // to trust an unstated invariant it cannot check for itself — that nobody
  // ever sets a notice while the row still reads `validated` — instead of
  // enforcing "a sent notice locks the decision" on its own terms.
  const hasNote = (input.note ?? '').trim().length > 0
  if ((to === 'rejected' || locked || changesAPriorDecision(from, to)) && !hasNote) return 'note_required'

  return null
}

export function noticeDecisionFor(status: RegistrationStatus): NoticeDecision | null {
  return status === 'rejected' || status === 'selected' || status === 'not_selected' ? status : null
}

/**
 * The seven required steps, by the fields each renders. Calendar (step 6) is
 * the only step with no rule, so it is not here: the measure exists to find
 * people who still owe something, and an optional step cannot be owed.
 */
const SECTIONS: readonly (readonly RegistrationFieldPath[])[] = [
  ['personal.name', 'personal.email', 'personal.whatsapp', 'personal.birthDate', 'personal.branch', 'personal.state', 'personal.city'],
  ['academic.school', 'academic.grade', 'academic.graduationYear'],
  ['athletic.club', 'athletic.coach', 'athletic.ghin'],
  ['results'],
  ['rankings'],
  ['motivationLetter'],
  ['confirmations.rules', 'confirmations.scholarshipUnderstood', 'confirmations.privacy'],
]

export const SECTIONS_TOTAL = SECTIONS.length

/** How many of the seven required sections pass their rules. */
export function sectionsComplete(data: RegistrationData): number {
  const failing = new Set(validateRegistration(data).map((e) => e.field))
  return SECTIONS.filter((fields) => fields.every((f) => !failing.has(f))).length
}
