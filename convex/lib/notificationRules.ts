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
  }
  return [...out].map(([userId, kind]) => ({ userId, kind }))
}

/** A member, or anyone who may write in a journal. Finance never has a bell. */
export function canReceiveNotifications(roles: readonly Role[], isMember: boolean): boolean {
  return isMember || can(roles, 'comment_journal')
}

export type NotificationTarget = { to: string; params?: { id: string }; search?: { entrada: string } }

/**
 * Where opening a notification lands. The recipient is the athlete when the
 * row is about them; anyone else is staff and goes to the athlete's page.
 */
export function targetFor(n: { userId: string; athleteId: string; kind: NotificationKind; entryId?: string }): NotificationTarget {
  const isAthlete = n.userId === n.athleteId
  const search = n.entryId ? { entrada: n.entryId } : undefined
  if (isAthlete) {
    if (n.kind === 'assignment_created' || n.kind === 'assignment_ended') return { to: '/perfil' }
    return { to: '/bitacora', search }
  }
  return { to: '/administracion/atletas/$id', params: { id: n.athleteId }, search }
}
