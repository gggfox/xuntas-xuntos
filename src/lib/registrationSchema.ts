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
 * Stopgap. `src/lib/registrationRules.ts` holds the real rules, which return
 * codes instead of prose. This keeps the tree typechecking until the form
 * and the server have both moved onto them; it is deleted then.
 */
export function validateRegistration(_d: RegistrationDataType): string[] {
  return []
}
