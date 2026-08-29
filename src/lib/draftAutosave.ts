/**
 * The decision behind draft autosave, as two pure functions.
 *
 * It is split out of the component because `shouldSaveDraft` is load-bearing:
 * it cuts a feedback loop, and a loop is exactly the kind of thing that hides
 * inside a component rewrite.
 */

export function fingerprint(value: unknown): string {
  return JSON.stringify(value)
}

/**
 * Whether a draft is worth writing.
 *
 * Saving bumps `updatedAt`, which invalidates the reactive Convex query
 * feeding the screen, which re-renders the parent, which offers the same
 * values back. Returning `true` there would mean every open tab wrote to
 * Convex on a timer forever, with nobody typing.
 */
export function shouldSaveDraft(next: string, lastSaved: string): boolean {
  return next !== lastSaved
}
