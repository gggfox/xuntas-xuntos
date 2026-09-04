import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getLocale } from '../paraglide/runtime.js'
import { formatDay, titleOf } from '../lib/cycle'

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
    title: titleOf(c.cycle, locale),
    opensOnText: formatDay(c.opensOn, locale),
    closesOnText: formatDay(c.closesOn, locale),
    reviewOnText: formatDay(c.reviewOn, locale),
  }
}
