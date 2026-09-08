/**
 * Every error this app can produce, as a code.
 *
 * Rules and mutations return codes, never prose. Prose is the client's job
 * (`src/lib/registrationErrors.ts`), which is what makes a server-side
 * rejection readable in English instead of always Spanish.
 */

/** A rejection attached to one field of a form. */
export type FieldErrorCode =
  | 'name_required'
  | 'name_too_short'
  | 'email_invalid'
  | 'whatsapp_invalid'
  | 'birth_date_required'
  | 'birth_date_future'
  | 'birth_date_implausible'
  | 'branch_required'
  | 'state_required'
  | 'city_required'
  | 'school_required'
  | 'grade_required'
  | 'graduation_year_invalid'
  | 'club_required'
  | 'coach_required'
  | 'ghin_required'
  | 'results_required'
  | 'rankings_required'
  | 'letter_required'
  | 'letter_too_short'
  | 'letter_too_long'
  | 'confirm_rules_required'
  | 'confirm_scholarship_required'
  | 'confirm_privacy_required'
  | 'guardian_name_required'
  | 'guardian_name_too_long'
  | 'guardian_email_invalid'
  | 'guardian_email_same_as_own'

/** A rejection of the whole action, thrown rather than returned. */
type ActionErrorCode =
  | 'window_closed'
  | 'already_reviewed'
  | 'birth_date_missing'
  | 'birth_date_locked'
  | 'not_signed_in'
  | 'permission_required'
  | 'guardian_not_required'
  | 'guardian_already_confirmed'
  | 'field_too_long'
  | 'too_many_rows'
  | 'letter_too_long'
  // Staff and invitations.
  | 'invite_email_invalid'
  | 'invite_roles_invalid'
  | 'invite_invalid'
  | 'invite_revoked'
  | 'invite_accepted'
  | 'invite_wait'
  | 'cannot_remove_own_master_admin'
  | 'cannot_remove_last_master_admin'
  | 'user_not_found'
  // Cycles.
  | 'cycle_title_required'
  | 'cycle_title_taken'
  | 'cycle_dates_invalid'
  | 'cycle_review_before_close'
  | 'cycle_not_found'
  | 'no_active_cycle'
  | 'window_open'
  // Decisions and notices.
  | 'decision_invalid'
  | 'note_required'
  | 'guardian_unconfirmed'
  | 'decision_locked'
  | 'notice_not_pending'
  | 'registration_not_found'
  | 'nothing_to_send'
  // Members, assignments, the journal.
  | 'not_a_member'
  | 'athlete_not_found'
  | 'journal_frozen'
  | 'entry_not_found'
  | 'entry_title_required'
  | 'entry_title_too_long'
  | 'entry_date_invalid'
  | 'entry_body_required'
  | 'entry_body_too_long'
  | 'entry_score_too_long'
  | 'entry_score_not_allowed'
  | 'entry_has_comments'
  | 'not_entry_author'
  | 'comment_required'
  | 'comment_too_long'
  | 'comment_not_found'
  | 'not_comment_author'
  | 'assignment_target_invalid'
  | 'notification_not_found'
  /** Nothing more specific survived the trip. Renders as `err_generic`. */
  | 'generic'

export type AppErrorCode = FieldErrorCode | ActionErrorCode
