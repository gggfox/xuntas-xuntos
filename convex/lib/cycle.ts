/**
 * Age arithmetic for the age gate. The window itself lives in the `cycles`
 * table now — see `convex/lib/cycleRules.ts` and `convex/cycles.ts`.
 */

import { MX_OFFSET_MS } from './cycleRules'

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

  const today = new Date(now - MX_OFFSET_MS)
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
