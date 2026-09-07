import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { fail, requireUser } from './auth'
import { canCommentOn, canWriteEntries } from './lib/athleteAccess'
import { canDeleteEntry, todayISO, validateComment, validateEntry } from './lib/journalRules'
import { permissionsOf } from './lib/permissions'
import { activeAssignmentsOf, membershipOf, requireAthleteAccess, type AthleteContext } from './members'
import { notify } from './notifications'

/**
 * The bitácora: entries the athlete writes, comments the team leaves. Every
 * read goes through `requireAthleteAccess`; every write also asks whether
 * the journal is still alive (a removed member's is not).
 */

const vKind = v.union(v.literal('tournament'), v.literal('training'))

const entryArgs = {
  kind: vKind,
  title: v.string(),
  date: v.string(),
  body: v.string(),
  score: v.optional(v.string()),
}

function publicEntry(e: Doc<'journalEntries'>) {
  return {
    _id: e._id,
    athleteUserId: e.athleteUserId,
    kind: e.kind,
    title: e.title,
    date: e.date,
    body: e.body,
    score: e.score,
    createdAt: e.createdAt,
    editedAt: e.editedAt,
    commentCount: e.commentCount,
  }
}

function accessOf(c: AthleteContext) {
  return {
    permissions: permissionsOf(c.actor.roles),
    isSelf: c.isSelf,
    isAssigned: c.isAssigned,
    isMember: c.member !== null,
  }
}

/** The stats row for one athlete, brought up to date after a write. */
async function refreshStats(ctx: MutationCtx, athleteUserId: Id<'users'>, delta: number) {
  const existing = await ctx.db
    .query('journalStats')
    .withIndex('by_athlete', (q) => q.eq('athleteUserId', athleteUserId))
    .unique()
  const newest = await ctx.db
    .query('journalEntries')
    .withIndex('by_athlete_date', (q) => q.eq('athleteUserId', athleteUserId))
    .order('desc')
    .first()
  const next = {
    athleteUserId,
    entryCount: Math.max(0, (existing?.entryCount ?? 0) + delta),
    lastEntryDate: newest?.date,
  }
  if (existing) await ctx.db.patch(existing._id, next)
  else await ctx.db.insert('journalStats', next)
}

/** The athlete's own entry, alive. Every entry write starts here. */
async function requireOwnEntry(ctx: QueryCtx, id: Id<'journalEntries'>) {
  const actor = await requireUser(ctx)
  const entry = await ctx.db.get(id)
  if (!entry) fail('entry_not_found')
  if (entry.athleteUserId !== actor._id) fail('not_entry_author')
  if (!(await membershipOf(ctx, actor._id))) fail('journal_frozen')
  return { actor, entry }
}

/**
 * The feed, newest day first (and within a day, newest written first —
 * the index's implicit creation-time tiebreak). `from`/`to` are ISO days,
 * both inclusive; either may be absent.
 */
export const entries = query({
  args: {
    athleteUserId: v.id('users'),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAthleteAccess(ctx, args.athleteUserId)
    const { from, to } = args
    const page = await ctx.db
      .query('journalEntries')
      .withIndex('by_athlete_date', (q) => {
        const byAthlete = q.eq('athleteUserId', args.athleteUserId)
        if (from && to) return byAthlete.gte('date', from).lte('date', to)
        if (from) return byAthlete.gte('date', from)
        if (to) return byAthlete.lte('date', to)
        return byAthlete
      })
      .order('desc')
      .paginate(args.paginationOpts)
    return { ...page, page: page.page.map(publicEntry) }
  },
})

/** One entry, for a notification that points at it. `null` when it is gone. */
export const entry = query({
  args: { id: v.id('journalEntries') },
  handler: async (ctx, args) => {
    const e = await ctx.db.get(args.id)
    if (!e) return null
    await requireAthleteAccess(ctx, e.athleteUserId)
    return publicEntry(e)
  },
})

export const createEntry = mutation({
  args: entryArgs,
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx)
    const member = await membershipOf(ctx, actor._id)
    if (!canWriteEntries({ isSelf: true, isMember: member !== null })) fail('not_a_member')
    const problem = validateEntry(args, todayISO())
    if (problem) fail(problem)

    const score = args.score?.trim() || undefined
    const id = await ctx.db.insert('journalEntries', {
      athleteUserId: actor._id,
      kind: args.kind,
      title: args.title.trim(),
      date: args.date,
      body: args.body.trim(),
      score,
      createdAt: Date.now(),
      commentCount: 0,
    })
    await refreshStats(ctx, actor._id, +1)

    const assigned = await activeAssignmentsOf(ctx, actor._id)
    await notify(
      ctx,
      { type: 'entry_created', actorId: actor._id, athleteId: actor._id, assignedStaffIds: assigned.map((a) => a.staffUserId) },
      { athleteId: actor._id, entryId: id },
    )
    return { id }
  },
})

/** Edits keep the entry and mark it edited; they tell nobody. */
export const updateEntry = mutation({
  args: { id: v.id('journalEntries'), ...entryArgs },
  handler: async (ctx, args) => {
    const { actor, entry } = await requireOwnEntry(ctx, args.id)
    const problem = validateEntry(args, todayISO())
    if (problem) fail(problem)
    const dateChanged = entry.date !== args.date
    await ctx.db.patch(entry._id, {
      kind: args.kind,
      title: args.title.trim(),
      date: args.date,
      body: args.body.trim(),
      score: args.kind === 'tournament' ? args.score?.trim() || undefined : undefined,
      editedAt: Date.now(),
    })
    if (dateChanged) await refreshStats(ctx, actor._id, 0)
    return { ok: true as const }
  },
})

export const deleteEntry = mutation({
  args: { id: v.id('journalEntries') },
  handler: async (ctx, args) => {
    const { actor, entry } = await requireOwnEntry(ctx, args.id)
    const problem = canDeleteEntry(entry)
    if (problem) fail(problem)
    await ctx.db.delete(entry._id)
    await refreshStats(ctx, actor._id, -1)
    return { ok: true as const }
  },
})

/** A thread — an entry's, or with no `entryId` the athlete's general stream — newest first. */
export const comments = query({
  args: { athleteUserId: v.id('users'), entryId: v.optional(v.id('journalEntries')) },
  handler: async (ctx, args) => {
    const c = await requireAthleteAccess(ctx, args.athleteUserId)
    const rows = await ctx.db
      .query('journalComments')
      .withIndex('by_athlete_entry', (q) => q.eq('athleteUserId', args.athleteUserId).eq('entryId', args.entryId))
      .order('desc')
      .collect()
    const authors = new Map<Id<'users'>, Doc<'users'> | null>()
    for (const r of rows) {
      if (!authors.has(r.authorId)) authors.set(r.authorId, await ctx.db.get(r.authorId))
    }
    return {
      canComment: canCommentOn(accessOf(c)),
      comments: rows.map((r) => {
        const a = authors.get(r.authorId)
        return {
          _id: r._id,
          body: r.body,
          createdAt: r.createdAt,
          authorName: a?.name ?? a?.email ?? '',
          /** Roles other than `athlete`, so the card can say "Coach"; empty for the athlete. */
          authorRoles: (a?.roles ?? []).filter((role) => role !== 'athlete'),
          isAthlete: r.authorId === args.athleteUserId,
          isMine: r.authorId === c.actor._id,
        }
      }),
    }
  },
})

export const addComment = mutation({
  args: { athleteUserId: v.id('users'), entryId: v.optional(v.id('journalEntries')), body: v.string() },
  handler: async (ctx, args) => {
    const c = await requireAthleteAccess(ctx, args.athleteUserId)
    if (!c.member) fail('journal_frozen')
    if (!canCommentOn(accessOf(c))) fail('permission_required')
    const problem = validateComment(args.body)
    if (problem) fail(problem)

    let entryDoc: Doc<'journalEntries'> | null = null
    if (args.entryId) {
      entryDoc = await ctx.db.get(args.entryId)
      if (!entryDoc || entryDoc.athleteUserId !== args.athleteUserId) fail('entry_not_found')
    }

    // Who was already in the thread, for the rules to pick the replies' recipients.
    const before = await ctx.db
      .query('journalComments')
      .withIndex('by_athlete_entry', (q) => q.eq('athleteUserId', args.athleteUserId).eq('entryId', args.entryId))
      .collect()

    const id = await ctx.db.insert('journalComments', {
      athleteUserId: args.athleteUserId,
      entryId: args.entryId,
      authorId: c.actor._id,
      body: args.body.trim(),
      createdAt: Date.now(),
    })
    if (entryDoc) await ctx.db.patch(entryDoc._id, { commentCount: entryDoc.commentCount + 1 })

    await notify(
      ctx,
      {
        type: 'comment',
        actorId: c.actor._id,
        athleteId: args.athleteUserId,
        general: !args.entryId,
        threadAuthorIds: before.map((r) => r.authorId),
      },
      { athleteId: args.athleteUserId, entryId: args.entryId, commentId: id },
    )
    return { id }
  },
})

/** The author alone, hard. Nothing tells anyone. */
export const deleteComment = mutation({
  args: { id: v.id('journalComments') },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx)
    const comment = await ctx.db.get(args.id)
    if (!comment) fail('comment_not_found')
    if (comment.authorId !== actor._id) fail('not_comment_author')
    await ctx.db.delete(comment._id)
    if (comment.entryId) {
      const e = await ctx.db.get(comment.entryId)
      if (e) await ctx.db.patch(e._id, { commentCount: Math.max(0, e.commentCount - 1) })
    }
    return { ok: true as const }
  },
})
