/**
 * The picker's three views, and how they funnel into one another.
 *
 * Picking in a coarse view is not a choice of date. A year narrows to its
 * months and a month to its days; only `days` reports anything back to the
 * field, which is why it drills nowhere. The chain lives here because it was
 * otherwise spelled out inside three separate click handlers, and you had to
 * read all three to learn that the picker is a funnel at all.
 *
 * The title button is the other direction — it jumps straight out to years —
 * and stays in `Calendar.tsx`: it is a shortcut, not a step of this walk.
 */
export const VIEWS = {
  days: { drillsTo: null },
  months: { drillsTo: 'days' },
  years: { drillsTo: 'months' },
} as const

export type View = keyof typeof VIEWS
