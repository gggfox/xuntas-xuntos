/**
 * Re-exports the registration shape from the backend.
 *
 * See `convex/lib/registrationSchema.ts`. Nothing here is a copy: a second
 * definition of `RegistrationData` is a second thing to keep in sync.
 */
export {
  LETTER_LIMIT,
  FIXED_RANKINGS,
  emptyRow,
  emptyRegistration,
  prepareForSubmit,
} from '../../convex/lib/registrationSchema'

export type { Row, RegistrationData } from '../../convex/lib/registrationSchema'

import type { RegistrationData as RegistrationDataType } from '../../convex/lib/registrationSchema'

/**
 * Stopgap. Replaced by `src/lib/registrationRules.ts`, which returns codes
 * instead of prose. It keeps the tree typechecking while the shape moves.
 */
export function validateRegistration(_d: RegistrationDataType): string[] {
  return []
}
