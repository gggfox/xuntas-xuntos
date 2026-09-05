import type { AppErrorCode } from './errorCodes'

/**
 * The call-for-applications window, as arithmetic over a `cycles` row.
 *
 * Mexico no longer observes daylight saving time (since 2022), so
 * America/Mexico_City is UTC-6 all year round. Days are stored as
 * `yyyy-mm-dd` and turned into instants here and nowhere else, so the client
 * and the server cannot disagree about when September 18 ends.
 */

export const MX_OFFSET_MS = 6 * 60 * 60 * 1000

export type CycleFields = {
  opensOn: string
  closesOn: string
  reviewOn: string
  isActive: boolean
  title?: string
}

export type CycleInput = {
  cycle: string
  title: string
  opensOn: string
  closesOn: string
  reviewOn: string
}

/** A `yyyy-mm-dd` to its three numbers, or null if it is not a real day. */
function parts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const probe = new Date(Date.UTC(y, mo - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null
  }
  return { y, m: mo, d }
}

/** 00:00:00.000 of that day, Mexico City. */
export function dayStartMs(iso: string): number | null {
  const p = parts(iso)
  if (!p) return null
  return Date.UTC(p.y, p.m - 1, p.d) + MX_OFFSET_MS
}

/** 23:59:59.999 of that day, Mexico City. */
export function dayEndMs(iso: string): number | null {
  const start = dayStartMs(iso)
  return start === null ? null : start + 24 * 60 * 60 * 1000 - 1
}

/** Rows are validated on write, so an unreadable day here is a bug, not input. */
export function windowOf(c: { opensOn: string; closesOn: string }): {
  opensAtMs: number
  closesAtMs: number
} {
  const opensAtMs = dayStartMs(c.opensOn)
  const closesAtMs = dayEndMs(c.closesOn)
  if (opensAtMs === null || closesAtMs === null) {
    throw new Error(`[cycleRules] unreadable window ${c.opensOn}..${c.closesOn}`)
  }
  return { opensAtMs, closesAtMs }
}

export function isWindowOpenFor(
  c: { opensOn: string; closesOn: string },
  now: number = Date.now(),
): boolean {
  const { opensAtMs, closesAtMs } = windowOf(c)
  return now >= opensAtMs && now <= closesAtMs
}

/**
 * `isOpen` / `beforeOpening` from the window's own instants, checked against
 * `now` at the moment this runs. A Convex query only re-executes when its
 * DATA changes, and wall-clock time is not data — so a reader who caches
 * these two booleans from a query result can go on believing the window is
 * closed (or open) long after the clock disagrees. Call this again on every
 * render instead of trusting a snapshot.
 */
export function windowStatusAt(
  opensAtMs: number,
  closesAtMs: number,
  now: number = Date.now(),
): { isOpen: boolean; beforeOpening: boolean } {
  return { isOpen: now >= opensAtMs && now <= closesAtMs, beforeOpening: now < opensAtMs }
}

/**
 * The key a call for applications is filed under — every `registrations` and
 * `guardianAuth` row points at one of these, so it stays a key: short,
 * unique, and locked once a row exists. It no longer has to be a date range:
 * an organisation running more than one call a year needs names like
 * `2026-2027-verano` or `beca-invierno`, not just `2026-2027`.
 */
const KEY_RE = /^[a-z0-9-]{2,40}$/i

export function validateCycle(input: CycleInput): AppErrorCode | null {
  if (!KEY_RE.test(input.cycle.trim())) return 'cycle_key_invalid'
  if (!input.title.trim()) return 'cycle_title_required'

  const opens = dayStartMs(input.opensOn)
  const closes = dayEndMs(input.closesOn)
  if (opens === null || closes === null || closes < opens) return 'cycle_dates_invalid'

  const review = dayStartMs(input.reviewOn)
  if (review === null || review <= closes) return 'cycle_review_before_close'

  return null
}

/**
 * The title before this change existed: derived from the key, never typed.
 * A row written before titles existed has no `title` of its own, so this is
 * what `cycleTitle` falls back to for it — and what `cycles.seed` writes as
 * the 2026–2027 row's actual title, since a seeded row needs something to
 * start with.
 */
export function titleOf(cycle: string, locale: 'es' | 'en'): string {
  const pretty = cycle.replace('-', '–')
  return locale === 'es'
    ? `Convocatoria General ${pretty}`
    : `${pretty} General Call for Applications`
}

/**
 * What a call is actually called, for display: the title an admin typed, or
 * — for a row written before titles existed — the key dressed up the way
 * `titleOf` always formatted it. Everything that shows a call's name to a
 * reader goes through this rather than reading `title` or `cycle` directly,
 * so the one row still missing a title does not render blank.
 */
export function cycleTitle(row: { cycle: string; title?: string }, locale: 'es' | 'en'): string {
  return row.title?.trim() || titleOf(row.cycle, locale)
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The shape the copy already used: "18 de septiembre de 2026" / "September 18, 2026". */
export function formatDay(iso: string, locale: 'es' | 'en'): string {
  const p = parts(iso)
  if (!p) return iso
  return locale === 'es'
    ? `${p.d} de ${MONTHS_ES[p.m - 1]} de ${p.y}`
    : `${MONTHS_EN[p.m - 1]} ${p.d}, ${p.y}`
}
