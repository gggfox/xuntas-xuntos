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
