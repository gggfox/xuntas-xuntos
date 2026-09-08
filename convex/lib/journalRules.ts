import type { AppErrorCode } from './errorCodes'
import { MX_OFFSET_MS, dayStartMs } from './cycleRules'

/**
 * The rules of the bitácora, as pure functions returning codes. The
 * `journal.ts` mutations run them before writing; the entry dialog runs
 * them for immediate feedback. Same shape as `staffRules.ts`.
 */

export const ENTRY_KINDS = ['tournament', 'training'] as const
export type EntryKind = (typeof ENTRY_KINDS)[number]

export const TITLE_LIMIT = 120
export const BODY_LIMIT = 5000
export const SCORE_LIMIT = 40
export const COMMENT_LIMIT = 2000

export type EntryInput = {
  kind: EntryKind
  title: string
  /** ISO day, chosen by the athlete: the day of the tournament or the session, not the day of writing. */
  date: string
  body: string
  score?: string
}

/** The ISO day it is right now in Mexico City. The latest day an entry may carry. */
export function todayISO(now: number = Date.now()): string {
  const d = new Date(now - MX_OFFSET_MS)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

/**
 * `today` is passed in rather than read from the clock so the same input
 * validates the same way on the server and in a test.
 */
export function validateEntry(input: EntryInput, today: string): AppErrorCode | null {
  const title = input.title.trim()
  if (!title) return 'entry_title_required'
  if (title.length > TITLE_LIMIT) return 'entry_title_too_long'

  // A parseable day no later than today. ISO days compare as strings.
  if (dayStartMs(input.date) === null || input.date > today) return 'entry_date_invalid'

  const body = input.body.trim()
  if (!body) return 'entry_body_required'
  if (body.length > BODY_LIMIT) return 'entry_body_too_long'

  const score = (input.score ?? '').trim()
  if (score && input.kind !== 'tournament') return 'entry_score_not_allowed'
  if (score.length > SCORE_LIMIT) return 'entry_score_too_long'

  return null
}

export function validateComment(body: string): AppErrorCode | null {
  const text = body.trim()
  if (!text) return 'comment_required'
  if (text.length > COMMENT_LIMIT) return 'comment_too_long'
  return null
}

/** An entry with comments stays: deleting it would take a coach's words with it. */
export function canDeleteEntry(entry: { commentCount: number }): AppErrorCode | null {
  return entry.commentCount > 0 ? 'entry_has_comments' : null
}
