/**
 * Re-exports the registration rules from the backend.
 *
 * See `convex/lib/registrationRules.ts`. The browser validating with a
 * different set of rules than the server enforces is the bug this prevents.
 */
export {
  NAME_MIN,
  WHATSAPP_MIN_DIGITS,
  LETTER_MIN,
  RESULTS_MIN,
  RANKINGS_MIN,
  checkName,
  checkEmail,
  checkWhatsapp,
  checkBirthDate,
  checkBranch,
  checkState,
  checkRequiredText,
  checkGraduationYear,
  countFilledRows,
  checkResults,
  checkRankings,
  checkLetter,
  validateRegistration,
  toErrorMap,
} from '../../convex/lib/registrationRules'

export type {
  RegistrationError,
  RegistrationFieldPath,
} from '../../convex/lib/registrationRules'
