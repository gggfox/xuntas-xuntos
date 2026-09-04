import { ConvexError } from 'convex/values'
import * as m from '../paraglide/messages.js'
import type { AppErrorCode } from '../../convex/lib/errorCodes'
import { LETTER_LIMIT } from './registrationSchema'
import { RESULTS_MIN } from './registrationRules'
import { FIELD_LIMIT, ROW_LIMIT } from '../../convex/lib/registrationLimits'

/**
 * Turns an error code into a sentence in the reader's language.
 *
 * This is the only place prose meets a code, and it is client-side on
 * purpose: the server used to build Spanish sentences, so an English session
 * that failed validation got Spanish back.
 */

const MESSAGES: Record<AppErrorCode, () => string> = {
  // Fields — most of these messages already existed and are simply reused.
  name_required: m.reg_name_error,
  name_too_short: m.reg_name_too_short,
  email_invalid: m.reg_email_error,
  whatsapp_invalid: m.reg_whatsapp_error,
  birth_date_required: m.gate_date_error,
  birth_date_future: m.gate_date_future,
  birth_date_implausible: m.gate_date_implausible,
  branch_required: m.reg_branch_error,
  state_required: m.reg_state_error,
  city_required: m.reg_city_error,
  school_required: m.reg_school_error,
  grade_required: m.reg_grade_error,
  graduation_year_invalid: m.reg_graduation_error,
  club_required: m.reg_club_error,
  coach_required: m.reg_coach_error,
  ghin_required: m.reg_ghin_error,
  results_required: () => m.reg_results_error({ n: RESULTS_MIN }),
  rankings_required: m.reg_rankings_error,
  letter_required: m.reg_letter_error,
  letter_too_short: m.reg_letter_too_short,
  letter_too_long: () => m.reg_letter_too_long({ limit: LETTER_LIMIT }),
  confirm_rules_required: m.reg_ck_rules_error,
  confirm_scholarship_required: m.reg_ck_scholarship_error,
  confirm_privacy_required: m.reg_ck_privacy_error,
  guardian_name_required: m.gate_guardian_name_error,
  guardian_name_too_long: m.gate_guardian_name_too_long,
  guardian_email_invalid: m.gate_guardian_email_error,
  guardian_email_same_as_own: m.gate_guardian_email_same,

  // Actions.
  window_closed: m.err_window_closed,
  already_reviewed: m.err_already_reviewed,
  birth_date_missing: m.err_birth_date_missing,
  birth_date_locked: m.err_birth_date_locked,
  not_signed_in: m.err_not_signed_in,
  permission_required: m.err_permission_required,
  guardian_not_required: m.err_guardian_not_required,
  guardian_already_confirmed: m.err_guardian_already_confirmed,
  field_too_long: () => m.err_field_too_long({ limit: FIELD_LIMIT }),
  too_many_rows: () => m.err_too_many_rows({ limit: ROW_LIMIT }),
  // Staff and invitations.
  invite_email_invalid: m.err_invite_email_invalid,
  invite_roles_invalid: m.err_invite_roles_invalid,
  invite_invalid: m.err_invite_invalid,
  invite_revoked: m.err_invite_revoked,
  invite_accepted: m.err_invite_accepted,
  invite_wait: m.err_invite_wait,
  cannot_remove_own_master_admin: m.err_cannot_remove_own_master_admin,
  cannot_remove_last_master_admin: m.err_cannot_remove_last_master_admin,
  user_not_found: m.err_user_not_found,
  cycle_name_invalid: m.err_cycle_name_invalid,
  cycle_dates_invalid: m.err_cycle_dates_invalid,
  cycle_review_before_close: m.err_cycle_review_before_close,
  cycle_exists: m.err_cycle_exists,
  cycle_not_found: m.err_cycle_not_found,
  no_active_cycle: m.err_no_active_cycle,
  window_open: m.err_window_open,
  // Decisions and notices.
  decision_invalid: m.err_decision_invalid,
  note_required: m.err_note_required,
  guardian_unconfirmed: m.err_guardian_unconfirmed,
  decision_locked: m.err_decision_locked,
  notice_not_pending: m.err_notice_not_pending,
  registration_not_found: m.err_registration_not_found,
  nothing_to_send: m.err_nothing_to_send,
  generic: m.err_generic,
}

export function errorMessage(code: AppErrorCode): string {
  return MESSAGES[code]()
}

/**
 * Digs the code out of whatever a Convex mutation threw.
 *
 * `ConvexError` carries a structured `data` payload across the wire; a plain
 * `Error` does not, and its message arrives wrapped in Convex's own framing.
 */
export function errorCodeFromConvex(err: unknown): AppErrorCode | undefined {
  if (!(err instanceof ConvexError)) return undefined
  const data = err.data as { code?: string } | undefined
  const code = data?.code
  if (typeof code !== 'string') return undefined
  return code in MESSAGES ? (code as AppErrorCode) : undefined
}

export function describeConvexError(err: unknown): string {
  const code = errorCodeFromConvex(err)
  return code ? errorMessage(code) : m.err_generic()
}
