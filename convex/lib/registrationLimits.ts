/**
 * Draft caps. Generous: they exist to bound the document, not to validate it.
 *
 * They live apart from `registrations.ts` because the client needs them to
 * render the message that says which cap was hit.
 */
export const FIELD_LIMIT = 500
export const ROW_LIMIT = 60
