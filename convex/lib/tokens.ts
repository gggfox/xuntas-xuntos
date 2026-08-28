/**
 * Single-use tokens: the guardian link and the pre-signup reference.
 *
 * Lives apart from `users.ts` so `preSignups.ts` does not have to import that
 * module — they import each other through the webhook, and the cycle left
 * TypeScript unable to infer Convex's generated types.
 */

/** 32 hex characters = 128 bits. Not guessable. */
export function newToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
