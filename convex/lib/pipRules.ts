import type { AppErrorCode } from './errorCodes'
import { MX_OFFSET_MS } from './cycleRules'

/**
 * The rules of the PIP, as pure functions returning codes. `pip.ts` runs
 * them before writing; the lead's composer will run them for immediate
 * feedback. Same shape as `journalRules.ts`.
 */

// --- Limits -----------------------------------------------------------------

export const POST_KINDS = ['content', 'session', 'challenge'] as const
export type PostKind = (typeof POST_KINDS)[number]

export const POST_STATUSES = ['draft', 'scheduled', 'published', 'unpublished'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const COMMENT_VISIBILITIES = ['off', 'lead', 'group'] as const
export type CommentsVisibility = (typeof COMMENT_VISIBILITIES)[number]

export const POST_TITLE_LIMIT = 100
export const POST_BODY_LIMIT = 10_000
export const PIP_COMMENT_LIMIT = 2000
export const ATTACHMENT_LIMIT = 10
export const GROUP_NAME_LIMIT = 60
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const VIDEO_MAX_BYTES = 250 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const

// --- Validation --------------------------------------------------------------

export type PostInput = {
  kind: PostKind
  title: string
  body: string
  commentsVisibility: CommentsVisibility
  attachmentCount: number
}

export function validatePost(input: PostInput): AppErrorCode | null {
  const title = input.title.trim()
  if (!title) return 'post_title_required'
  if (title.length > POST_TITLE_LIMIT) return 'post_title_too_long'
  const body = input.body.trim()
  if (!body) return 'post_body_required'
  if (body.length > POST_BODY_LIMIT) return 'post_body_too_long'
  if (input.attachmentCount > ATTACHMENT_LIMIT) return 'post_attachments_too_many'
  return null
}

export function validatePipComment(body: string): AppErrorCode | null {
  const text = body.trim()
  if (!text) return 'comment_required'
  if (text.length > PIP_COMMENT_LIMIT) return 'comment_too_long'
  return null
}

export function validateGroupName(name: string): AppErrorCode | null {
  const text = name.trim()
  if (!text) return 'group_name_required'
  if (text.length > GROUP_NAME_LIMIT) return 'group_name_too_long'
  return null
}

/** A post with reactions or comments stays: unpublish hides it, delete would take the words with it. */
export function canDeletePost(p: { commentCount: number; reactionCount: number }): AppErrorCode | null {
  return p.commentCount + p.reactionCount > 0 ? 'post_has_activity' : null
}

// --- Lifecycle ----------------------------------------------------------------

const NEXT: Record<PostStatus, readonly PostStatus[]> = {
  draft: ['scheduled', 'published'],
  scheduled: ['draft', 'published'],
  published: ['unpublished'],
  unpublished: ['published'],
}

/**
 * Four explicit states. A draft has no release; scheduling needs a future
 * moment; a stale job publishing a post that was moved back to draft is
 * refused by `pip.release` re-reading the status, not here.
 */
export function checkTransition(
  from: PostStatus,
  to: PostStatus,
  opts: { scheduledFor?: number; now: number },
): AppErrorCode | null {
  if (!NEXT[from].includes(to)) return 'post_status_invalid'
  if (to === 'scheduled' && !(opts.scheduledFor !== undefined && opts.scheduledFor > opts.now)) {
    return 'post_schedule_past'
  }
  return null
}

// --- Parsing ------------------------------------------------------------------

/**
 * One emoji: a single grapheme whose first scalar is pictographic. Skin
 * tones, joiner sequences and the variation selector all count as one
 * grapheme, which is what `Intl.Segmenter` is for.
 */
export function isEmoji(s: string): boolean {
  if (!s) return false
  const graphemes = [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(s)]
  if (graphemes.length !== 1) return false
  return /^\p{Extended_Pictographic}/u.test(s)
}

const YOUTUBE = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})(?:[&?#].*)?$/

export function youtubeIdFrom(url: string): string | null {
  const m = url.trim().match(YOUTUBE)
  return m ? m[1] : null
}

const ZOOM = /https?:\/\/[\w.-]*zoom\.us\/[^\s)]+/i

export function zoomLinkIn(body: string): string | null {
  return body.match(ZOOM)?.[0] ?? null
}

// --- Months -------------------------------------------------------------------

/** `YYYY-MM` of a moment, in Mexico City. */
export function monthKeyOf(ms: number): string {
  const d = new Date(ms - MX_OFFSET_MS)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** The half-open `[from, to)` in ms a month key covers, in Mexico City; null for anything that is not a key. */
export function monthRange(key: string): { from: number; to: number } | null {
  const m = key.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  return { from: Date.UTC(y, mo - 1, 1) + MX_OFFSET_MS, to: Date.UTC(y, mo, 1) + MX_OFFSET_MS }
}
