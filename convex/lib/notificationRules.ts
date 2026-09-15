import { can, type Role } from './permissions'

/**
 * Who hears about what, as pure functions. `notifications.ts` writes the
 * rows these return; the bell and the list draw the sentences.
 */

export const NOTIFICATION_KINDS = [
  'entry_comment',
  'entry_reply',
  'general_comment',
  'general_reply',
  'entry_created',
  'assignment_created',
  'assignment_ended',
  'pip_post_published',
  'pip_comment_reply',
  'pip_comment_new',
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** Ninety days. Read ones go; unread stay until read. */
export const PRUNE_AFTER_MS = 90 * 24 * 60 * 60 * 1000

/** What the bell drops down. */
export const DROPDOWN_LIMIT = 10

export type NotificationEvent =
  | {
      type: 'comment'
      actorId: string
      athleteId: string
      /** Whether this is the general stream rather than an entry's thread. */
      general: boolean
      /** Everyone who already wrote in this thread, repeats included. */
      threadAuthorIds: readonly string[]
    }
  | { type: 'entry_created'; actorId: string; athleteId: string; assignedStaffIds: readonly string[] }
  | { type: 'assignment'; ended: boolean; actorId: string; staffId: string; athleteId: string }
  | { type: 'pip_published'; actorId: string; memberIds: readonly string[] }
  | {
      type: 'pip_comment'
      actorId: string
      actorIsLead: boolean
      /** The top-level comment's author, when this is a reply. */
      parentAuthorId?: string
      /** Everyone holding `publish_pip`. */
      leadIds: readonly string[]
    }

/**
 * Who gets a row, and which kind. The actor never hears about their own
 * act; a person listed twice hears once.
 *
 * A comment by staff tells the athlete. A reply by the athlete tells the
 * staff who already wrote in that thread — not every assigned coach, and
 * not administration unless they spoke first. A new entry tells the
 * assigned staff. An assignment tells both parties.
 */
export function recipientsFor(event: NotificationEvent): Array<{ userId: string; kind: NotificationKind }> {
  const out = new Map<string, NotificationKind>()
  const add = (userId: string, kind: NotificationKind) => {
    if (userId !== event.actorId && !out.has(userId)) out.set(userId, kind)
  }

  switch (event.type) {
    case 'comment': {
      const byAthlete = event.actorId === event.athleteId
      if (byAthlete) {
        for (const id of event.threadAuthorIds) {
          if (id !== event.athleteId) add(id, event.general ? 'general_reply' : 'entry_reply')
        }
      } else {
        add(event.athleteId, event.general ? 'general_comment' : 'entry_comment')
      }
      break
    }
    case 'entry_created':
      for (const id of event.assignedStaffIds) add(id, 'entry_created')
      break
    case 'assignment': {
      const kind = event.ended ? 'assignment_ended' : 'assignment_created'
      add(event.staffId, kind)
      add(event.athleteId, kind)
      break
    }
    case 'pip_published':
      for (const id of event.memberIds) add(id, 'pip_post_published')
      break
    case 'pip_comment': {
      // The parent author hears a reply. The leads hear "new comments" —
      // once per post, which `notify` enforces — unless the lead is the one
      // writing, in which case only the parent author hears.
      if (event.parentAuthorId) add(event.parentAuthorId, 'pip_comment_reply')
      if (!event.actorIsLead) for (const id of event.leadIds) add(id, 'pip_comment_new')
      break
    }
  }
  return [...out].map(([userId, kind]) => ({ userId, kind }))
}

/** A member, anyone who may write in a journal, or a PIP lead. Finance never has a bell. */
export function canReceiveNotifications(roles: readonly Role[], isMember: boolean): boolean {
  return isMember || can(roles, 'comment_journal') || can(roles, 'publish_pip')
}

export type NotificationTarget = {
  to: string
  params?: { id: string }
  search?: { entrada?: string; publicacion?: string }
}

/**
 * Where opening a notification lands. A journal row is about an athlete:
 * the athlete goes to their own pages, staff to the athlete's. A PIP row is
 * about a post: everyone goes to the feed at that post — the lead's own
 * screen is a later plan, and will get its own target then.
 */
export function targetFor(n: {
  userId: string
  athleteId?: string
  kind: NotificationKind
  entryId?: string
  postId?: string
}): NotificationTarget {
  if (n.kind === 'pip_post_published' || n.kind === 'pip_comment_reply' || n.kind === 'pip_comment_new') {
    const search = n.postId ? { publicacion: n.postId } : undefined
    return { to: '/pip', search }
  }
  const isAthlete = n.userId === n.athleteId
  const search = n.entryId ? { entrada: n.entryId } : undefined
  if (isAthlete) {
    if (n.kind === 'assignment_created' || n.kind === 'assignment_ended') return { to: '/perfil' }
    return { to: '/bitacora', search }
  }
  return { to: '/administracion/atletas/$id', params: { id: n.athleteId ?? '' }, search }
}
