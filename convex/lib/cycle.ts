/**
 * Window of the 2026–2027 General Call for Applications.
 *
 * Mexico no longer observes daylight saving time (since 2022), so
 * America/Mexico_City is UTC-6 all year round. The constants are stored in UTC
 * so they do not depend on the server's or the browser's time zone.
 */

export const CURRENT_CYCLE = '2026-2027'

/** September 4, 2026, 00:00 America/Mexico_City. */
export const OPENS_AT_MS = Date.parse('2026-09-04T06:00:00.000Z')

/** September 18, 2026, 23:59:59 America/Mexico_City. */
export const CLOSES_AT_MS = Date.parse('2026-09-19T05:59:59.999Z')

/** Date promised to registrants for the review. */
export const REVIEW_DATE = '23 de septiembre de 2026'

/**
 * Development hatch: opens the window even when it is not September.
 *
 * Without this there is no way to test the form before September 4, which is
 * exactly when nothing can be tested anymore. In Convex it is enabled with
 * `npx convex env set WINDOW_ALWAYS_OPEN true`; on the client with
 * VITE_WINDOW_ALWAYS_OPEN in .env.local.
 *
 * Do NOT enable it in production: it would let registrations in outside the
 * call for applications and the Council would be grading people who arrived
 * in October.
 */
function isWindowForced(): boolean {
  if (typeof process !== 'undefined' && process.env?.WINDOW_ALWAYS_OPEN === 'true') {
    return true
  }
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env
    if (env?.VITE_WINDOW_ALWAYS_OPEN === 'true') return true
  } catch {
    // import.meta.env does not exist in every runtime; that's fine.
  }
  return false
}

export function isWindowOpen(now: number = Date.now()): boolean {
  if (isWindowForced()) return true
  return now >= OPENS_AT_MS && now <= CLOSES_AT_MS
}

/** America/Mexico_City is UTC-6 all year round since 2022. */
const OFFSET_MX_MS = 6 * 60 * 60 * 1000

/** A `yyyy-mm-dd` date to its three numbers. `null` if it lacks that shape. */
function isoParts(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Rejects February 31 and friends.
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

export function isValidBirthDate(iso: string, now: number = Date.now()): boolean {
  const p = isoParts(iso)
  if (!p) return false
  const ms = Date.UTC(p.year, p.month - 1, p.day)
  if (ms > now) return false
  if (p.year < 1930) return false
  return true
}

/**
 * Age reached on a given date. Used exactly once, when the account is created:
 * `wasMinorAtSignup` is frozen and never recomputed, so nobody stops being a
 * minor mid-process and the consent trail gets lost.
 *
 * The "today" is resolved in central Mexico time, not UTC. With UTC, someone
 * turning 18 today started counting as an adult from 6 p.m. yesterday, local
 * time — six hours in which the system decided differently than the law.
 *
 * Returns -1 if the date is not a valid `yyyy-mm-dd`, so callers do not
 * confuse "I don't know" with "newborn".
 */
export function ageAt(birthDateISO: string, now: number = Date.now()): number {
  const birth = isoParts(birthDateISO)
  if (!birth) return -1

  const today = new Date(now - OFFSET_MX_MS)
  const todayYear = today.getUTCFullYear()
  const todayMonth = today.getUTCMonth() + 1
  const todayDay = today.getUTCDate()

  let age = todayYear - birth.year
  if (todayMonth < birth.month || (todayMonth === birth.month && todayDay < birth.day)) age--
  return age
}

export function isUnderage(birthDateISO: string, now: number = Date.now()): boolean {
  const age = ageAt(birthDateISO, now)
  // An unreadable date is treated as a minor: the expensive mistake is the other one.
  if (age < 0) return true
  return age < 18
}
