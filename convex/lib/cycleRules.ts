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
}

export type CycleInput = {
  cycle: string
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

const NAME_RE = /^(\d{4})-(\d{4})$/

export function validateCycle(input: CycleInput): AppErrorCode | null {
  const name = NAME_RE.exec(input.cycle.trim())
  if (!name || Number(name[2]) !== Number(name[1]) + 1) return 'cycle_name_invalid'

  const opens = dayStartMs(input.opensOn)
  const closes = dayEndMs(input.closesOn)
  if (opens === null || closes === null || closes < opens) return 'cycle_dates_invalid'

  const review = dayStartMs(input.reviewOn)
  if (review === null || review <= closes) return 'cycle_review_before_close'

  return null
}

/** Derived, never typed: fewer free-text fields means fewer ways for two pages to disagree. */
export function titleOf(cycle: string, locale: 'es' | 'en'): string {
  const pretty = cycle.replace('-', '–')
  return locale === 'es'
    ? `Convocatoria General ${pretty}`
    : `${pretty} General Call for Applications`
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
