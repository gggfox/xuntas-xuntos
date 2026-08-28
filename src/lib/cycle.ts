/**
 * Re-exports the cycle constants from the backend.
 *
 * The dates of the call for applications live in `convex/lib/cycle.ts` and
 * nowhere else: if the client and the server could disagree about when
 * registration closes, they would disagree precisely on September 18 at 23:59.
 */
export {
  CURRENT_CYCLE,
  OPENS_AT_MS,
  CLOSES_AT_MS,
  REVIEW_DATE,
  isWindowOpen,
  ageAt,
  isUnderage,
} from '../../convex/lib/cycle'
