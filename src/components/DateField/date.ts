/**
 * Calendar arithmetic for the date field.
 *
 * Everything here works on `{ y, m, d }` with a 1-based month, never on a
 * `Date` in local time. A birth date is a day on a wall calendar, not an
 * instant: `new Date('2005-06-23')` is midnight UTC, which in Mexico is the
 * 22nd at six in the evening, and the picker would light up the wrong cell.
 * The one place a `Date` appears it is built with `Date.UTC` and read back
 * with `getUTC*`, so no time zone ever gets a vote.
 */

export type Ymd = { y: number; m: number; d: number }

/** A `yyyy-mm-dd` string to its three numbers. `null` if it is not a real day. */
export function parseISO(iso: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!match) return null
  const p = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
  if (p.m < 1 || p.m > 12 || p.d < 1 || p.d > daysInMonth(p.y, p.m)) return null
  return p
}

export function toISO(p: Ymd): string {
  return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/**
 * A `yyyy-mm` string to the first of that month. `null` if it is not one.
 *
 * The competitive calendar asks which month a tournament falls in, not which
 * day, so its value is one segment shorter than a date of birth. It comes
 * back as a `Ymd` all the same: the picker's arithmetic, its bounds and its
 * grids are all written against three numbers, and a month is simply the day
 * it starts on.
 */
export function parseMonth(iso: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})$/.exec(iso.trim())
  if (!match) return null
  const p = { y: Number(match[1]), m: Number(match[2]), d: 1 }
  return p.m < 1 || p.m > 12 ? null : p
}

/** The `yyyy-mm` a day belongs to. The counterpart of `parseMonth`. */
export function toMonthISO(p: Ymd): string {
  return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}`
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Weekday of the 1st of the month, 0 = Sunday. */
export function firstWeekday(y: number, m: number): number {
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
}

/** Negative if `a` is earlier, 0 if the same day, positive if later. */
export function compare(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d
}

export function isSame(a: Ymd | null, b: Ymd | null): boolean {
  return a !== null && b !== null && compare(a, b) === 0
}

/** Clamps the day, so a month step out of January 31 lands on February 28. */
export function addMonths(p: Ymd, n: number): Ymd {
  const total = p.y * 12 + (p.m - 1) + n
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return { y, m, d: Math.min(p.d, daysInMonth(y, m)) }
}

export function addDays(p: Ymd, n: number): Ymd {
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n))
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

export function clamp(p: Ymd, min: Ymd, max: Ymd): Ymd {
  if (compare(p, min) < 0) return min
  if (compare(p, max) > 0) return max
  return p
}

/** America/Mexico_City is UTC-6 all year round since 2022. Same rule as `cycle.ts`. */
export function todayMX(now: number = Date.now()): Ymd {
  const d = new Date(now - 6 * 60 * 60 * 1000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}
