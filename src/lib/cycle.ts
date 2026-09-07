/**
 * Re-exports the cycle rules from the backend. The dates themselves live in
 * the `cycles` table and reach the client through `useActiveCycle`; what is
 * shared here is the arithmetic, so the two sides cannot disagree about when
 * a day ends.
 */
export { ageAt } from '../../convex/lib/cycle'
export { formatDay, windowStatusAt } from '../../convex/lib/cycleRules'
