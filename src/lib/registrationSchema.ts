/**
 * Re-exports the registration shape from the backend.
 *
 * See `convex/lib/registrationSchema.ts`. Nothing here is a copy: a second
 * definition of `RegistrationData` is a second thing to keep in sync.
 */
export { MEXICAN_STATES, isMexicanState } from '../../convex/lib/mexicanStates'
export type { MexicanState } from '../../convex/lib/mexicanStates'

export {
  LETTER_LIMIT,
  FIXED_RANKINGS,
  emptyRegistration,
  prepareForSubmit,
} from '../../convex/lib/registrationSchema'

export type { RegistrationData } from '../../convex/lib/registrationSchema'
