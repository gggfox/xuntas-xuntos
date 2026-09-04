import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getLocale } from '../paraglide/runtime.js'
import { formatDay, titleOf, windowStatusAt } from '../lib/cycle'

/**
 * The active call, with its dates already spelled out in the page's locale.
 * `undefined` while loading, `null` if no cycle is active (a configuration
 * fault, not a state the UI designs for).
 */
export function useActiveCycle() {
  const c = useQuery(api.cycles.active)
  if (!c) return c
  const locale = getLocale() as 'es' | 'en'
  return {
    ...c,
    // `c.isOpen` / `c.beforeOpening` came out of a reactive query that ran
    // once and will not re-run just because the clock moved. A tab left open
    // across the opening or closing instant would keep showing whatever was
    // true when the query last executed, so recompute from the raw instants
    // on every render instead of trusting the snapshot.
    ...windowStatusAt(c.opensAtMs, c.closesAtMs),
    title: titleOf(c.cycle, locale),
    opensOnText: formatDay(c.opensOn, locale),
    closesOnText: formatDay(c.closesOn, locale),
    reviewOnText: formatDay(c.reviewOn, locale),
  }
}
