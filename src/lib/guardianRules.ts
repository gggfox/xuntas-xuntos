/**
 * Re-exports the guardian rules from the backend.
 *
 * See `convex/lib/guardianRules.ts`.
 */
export {
  GUARDIAN_NAME_LIMIT,
  checkGuardianName,
  checkGuardianEmail,
  validateBirthDateDeclaration,
} from '../../convex/lib/guardianRules'

export type {
  BirthDateDeclaration,
  GuardianError,
  GuardianFieldPath,
} from '../../convex/lib/guardianRules'
