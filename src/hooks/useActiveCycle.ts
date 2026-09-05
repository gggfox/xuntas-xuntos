import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getLocale } from '../paraglide/runtime.js'
import { formatDay, windowStatusAt } from '../lib/cycle'

/**
 * The active call, with its dates already spelled out in the page's locale.
 * `undefined` while loading, `null` if no cycle is active (a configuration
 * fault, not a state the UI designs for).
 */
export function useActiveCycle() {
  const locale = getLocale() as 'es' | 'en'
  const c = useQuery(api.cycles.active, { locale })
  if (!c) return c
  return {
    ...c,
    // `c.isOpen` / `c.beforeOpening` came out of a reactive query that ran
    // once and will not re-run just because the clock moved. A tab left open
    // across the opening or closing instant would keep showing whatever was
    // true when the query last executed, so recompute from the raw instants
    // on every render instead of trusting the snapshot.
    ...windowStatusAt(c.opensAtMs, c.closesAtMs),
    // `c.title` is already resolved server-side, through `cycleTitle` —
    // typed by an admin, or `titleOf`'s fallback for a row that predates
    // titles. Nothing here derives it a second time.
    opensOnText: formatDay(c.opensOn, locale),
    closesOnText: formatDay(c.closesOn, locale),
    reviewOnText: formatDay(c.reviewOn, locale),
  }
}
