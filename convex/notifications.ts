import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { currentUser, fail, requireUser } from './auth'
import {
  DROPDOWN_LIMIT,
  PRUNE_AFTER_MS,
  recipientsFor,
  type NotificationEvent,
} from './lib/notificationRules'

/**
 * In-app notifications: a bell, a list, and a cron that forgets the read
 * ones. `notify` is the one way rows get written; the journal and the
 * assignments call it with an event and the rules say who hears.
 */

export async function notify(
  ctx: MutationCtx,
  event: NotificationEvent,
  about: { athleteId: Id<'users'>; entryId?: Id<'journalEntries'>; commentId?: Id<'journalComments'> },
): Promise<void> {
  const now = Date.now()
  for (const r of recipientsFor(event)) {
    await ctx.db.insert('notifications', {
      userId: r.userId as Id<'users'>,
      kind: r.kind,
      actorId: event.actorId as Id<'users'>,
      athleteId: about.athleteId,
      entryId: about.entryId,
      commentId: about.commentId,
      createdAt: now,
    })
  }
}

/** The names a sentence needs: who did it, about whom, and which entry. Resolved per row; the lists are short. */
async function describe(ctx: QueryCtx, n: Doc<'notifications'>) {
  const [actor, athlete, entry] = await Promise.all([
    ctx.db.get(n.actorId),
    ctx.db.get(n.athleteId),
    n.entryId ? ctx.db.get(n.entryId) : Promise.resolve(null),
  ])
  return {
    _id: n._id,
    kind: n.kind,
    userId: n.userId,
    athleteId: n.athleteId,
    entryId: n.entryId,
    createdAt: n.createdAt,
    readAt: n.readAt,
    actorName: actor?.name ?? actor?.email ?? '',
    athleteName: athlete?.name ?? athlete?.email ?? '',
    entryTitle: entry?.title,
  }
}

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return 0
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user_unread', (q) => q.eq('userId', user._id).eq('readAt', undefined))
      .collect()
    return rows.length
  },
})

/** What the bell drops down: the newest few, read or not. */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return []
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(DROPDOWN_LIMIT)
    return await Promise.all(rows.map((n) => describe(ctx, n)))
  },
})

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const page = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .paginate(args.paginationOpts)
    return { ...page, page: await Promise.all(page.page.map((n) => describe(ctx, n))) }
  },
})

export const markRead = mutation({
  args: { id: v.id('notifications') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const n = await ctx.db.get(args.id)
    // A stranger's id reads as missing, not as forbidden.
    if (!n || n.userId !== user._id) fail('notification_not_found')
    if (n.readAt === undefined) await ctx.db.patch(n._id, { readAt: Date.now() })
    return { ok: true as const }
  },
})

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user_unread', (q) => q.eq('userId', user._id).eq('readAt', undefined))
      .collect()
    const now = Date.now()
    for (const n of rows) await ctx.db.patch(n._id, { readAt: now })
    return { marked: rows.length }
  },
})

/** Daily. Read rows older than the window go; a full batch reschedules itself for the rest. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PRUNE_AFTER_MS
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_read', (q) => q.gt('readAt', 0).lt('readAt', cutoff))
      .take(500)
    for (const n of rows) await ctx.db.delete(n._id)
    if (rows.length === 500) await ctx.scheduler.runAfter(0, internal.notifications.prune, {})
    return { deleted: rows.length }
  },
})
