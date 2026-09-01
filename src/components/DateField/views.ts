/**
 * The picker's three views, and how they funnel into one another.
 *
 * Picking in a coarse view is not a choice of date. A year narrows to its
 * months and a month to its days; only the finest view reports anything back
 * to the field, which is why it drills nowhere. The chain lives here because
 * it was otherwise spelled out inside three separate click handlers, and you
 * had to read all three to learn that the picker is a funnel at all.
 *
 * Where the funnel ends is what the field is asking for. A date of birth is a
 * day, so it runs to the bottom. The competitive calendar asks which month a
 * tournament falls in — nobody knows the day yet, and inventing one is worse
 * than leaving the question at the month — so its funnel stops one step early
 * and `months` becomes the view that answers. That is the whole difference
 * between the two pickers' insides; everything else is the same walk.
 *
 * The title button is the other direction — it jumps straight out to years —
 * and stays in `Calendar.tsx`: it is a shortcut, not a step of this walk.
 */
export type View = 'days' | 'months' | 'years'

/** How fine an answer the field wants. */
export type Grain = 'day' | 'month'

export const GRAINS = {
  day: {
    opens: 'days',
    drillsTo: { years: 'months', months: 'days', days: null },
  },
  month: {
    opens: 'months',
    /* `days` is unreachable here — nothing drills to it — but the table stays
       total so the lookup in `Calendar` never has to narrow the view first. */
    drillsTo: { years: 'months', months: null, days: null },
  },
} as const satisfies Record<Grain, { opens: View; drillsTo: Record<View, View | null> }>
