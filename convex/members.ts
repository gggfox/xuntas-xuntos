import { v } from 'convex/values'
import { query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { currentUser, fail, requireUser } from './auth'
import { canCommentOn, canReadAthlete } from './lib/athleteAccess'
import { can, permissionsOf } from './lib/permissions'
import { vBranch } from './schema'
import { notify } from './notifications'

/**
 * Membership, and who may look at a member. The plain functions are shared
 * by `registrations.ts`, `assignments.ts` and `journal.ts`; the queries at
 * the bottom serve the profile and the staff list.
 *
 * A member is a person with a registration that reads `selected`. Removal
 * replaces that status, so "selected and not removed" is one index lookup.
 */

/** The registration that makes this person a member — the newest `selected` one — or null. */
export async function membershipOf(ctx: QueryCtx, userId: Id<'users'>): Promise<Doc<'registrations'> | null> {
  return await ctx.db
    .query('registrations')
    .withIndex('by_status_user', (q) => q.eq('status', 'selected').eq('userId', userId))
    .order('desc')
    .first()
}

/** The registration a removed member left behind, newest first. What administration still reads. */
export async function removedRegistrationOf(ctx: QueryCtx, userId: Id<'users'>): Promise<Doc<'registrations'> | null> {
  return await ctx.db
    .query('registrations')
    .withIndex('by_status_user', (q) => q.eq('status', 'removed').eq('userId', userId))
    .order('desc')
    .first()
}

export async function activeAssignmentsOf(ctx: QueryCtx, athleteUserId: Id<'users'>): Promise<Doc<'assignments'>[]> {
  return await ctx.db
    .query('assignments')
    .withIndex('by_athlete_active', (q) => q.eq('athleteUserId', athleteUserId).eq('endedAt', undefined))
    .collect()
}

export async function isAssignedTo(ctx: QueryCtx, staffUserId: Id<'users'>, athleteUserId: Id<'users'>): Promise<boolean> {
  const rows = await ctx.db
    .query('assignments')
    .withIndex('by_staff_athlete', (q) => q.eq('staffUserId', staffUserId).eq('athleteUserId', athleteUserId))
    .collect()
  return rows.some((a) => a.endedAt === undefined)
}

export type AthleteContext = {
  actor: Doc<'users'>
  athlete: Doc<'users'>
  /** The registration behind the membership; null once removed (or never selected). */
  member: Doc<'registrations'> | null
  isSelf: boolean
  isAssigned: boolean
}

/**
 * The one gate every journal read goes through. Fails `athlete_not_found`
 * for a missing person and `permission_required` for a real one the actor
 * may not see — never a code that would tell an outsider whether the id
 * they guessed belongs to a member.
 */
export async function requireAthleteAccess(ctx: QueryCtx, athleteUserId: Id<'users'>): Promise<AthleteContext> {
  const actor = await requireUser(ctx)
  const athlete = await ctx.db.get(athleteUserId)
  if (!athlete) fail('athlete_not_found')
  const member = await membershipOf(ctx, athleteUserId)
  const isSelf = actor._id === athleteUserId
  const isAssigned = isSelf ? false : await isAssignedTo(ctx, actor._id, athleteUserId)
  const allowed = canReadAthlete({
    permissions: permissionsOf(actor.roles),
    isSelf,
    isAssigned,
    isMember: member !== null,
  })
  if (!allowed) fail('permission_required')
  return { actor, athlete, member, isSelf, isAssigned }
}

/**
 * Ends every active assignment to this athlete. Returns the staff ids that
 * lost one, so the caller can tell them. Called by `decide` on removal.
 */
export async function endAllAssignmentsForAthlete(
  ctx: MutationCtx,
  athleteUserId: Id<'users'>,
  byId: Id<'users'>,
  now: number,
): Promise<Id<'users'>[]> {
  const active = await activeAssignmentsOf(ctx, athleteUserId)
  for (const a of active) {
    await ctx.db.patch(a._id, { endedAt: now })
    // The coach hears. The athlete does not: the removal email is theirs,
    // and a bell they can no longer reach would ring into a locked room.
    await notify(
      ctx,
      { type: 'assignment', ended: true, actorId: byId, staffId: a.staffUserId, athleteId: athleteUserId },
      { athleteId: athleteUserId },
    )
  }
  return active.map((a) => a.staffUserId)
}

// ---------------------------------------------------------------------------
// Queries

/** The signed-in member's own profile: the registration that selected them. `null` for everyone else. */
export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null
    const registration = await membershipOf(ctx, user._id)
    if (!registration) return null
    const cycle = await ctx.db.get(registration.cycle)
    return { registration, cycleTitle: cycle?.title ?? '' }
  },
})

async function statsOf(ctx: QueryCtx, athleteUserId: Id<'users'>) {
  const s = await ctx.db
    .query('journalStats')
    .withIndex('by_athlete', (q) => q.eq('athleteUserId', athleteUserId))
    .unique()
  return { entryCount: s?.entryCount ?? 0, lastEntryDate: s?.lastEntryDate }
}

/**
 * The members a staff member may see: all of them for administration, the
 * assigned ones for a coach or a health specialist. Filtered here, never
 * in the browser — the browser of a coach must not hold the roster.
 */
export const list = query({
  args: { branch: v.optional(vBranch) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx)
    const seesAll = can(actor.roles, 'view_all_athletes')
    if (!seesAll && !can(actor.roles, 'view_assigned_athletes')) fail('permission_required')

    // One registration per member, whichever selected them last.
    const byUser = new Map<Id<'users'>, Doc<'registrations'>>()
    if (seesAll) {
      const selected = await ctx.db
        .query('registrations')
        .withIndex('by_status_user', (q) => q.eq('status', 'selected'))
        .collect()
      for (const r of selected) {
        const prev = byUser.get(r.userId)
        if (!prev || r._creationTime > prev._creationTime) byUser.set(r.userId, r)
      }
    } else {
      const mine = await ctx.db
        .query('assignments')
        .withIndex('by_staff_active', (q) => q.eq('staffUserId', actor._id).eq('endedAt', undefined))
        .collect()
      for (const a of mine) {
        const r = await membershipOf(ctx, a.athleteUserId)
        if (r) byUser.set(a.athleteUserId, r)
      }
    }

    const rows = []
    for (const [userId, r] of byUser) {
      if (args.branch && r.personal.branch !== args.branch) continue
      const stats = await statsOf(ctx, userId)
      let staff: Array<{ name: string; roles: string[] }> | undefined
      if (seesAll) {
        const team = await activeAssignmentsOf(ctx, userId)
        const people = await Promise.all(team.map((a) => ctx.db.get(a.staffUserId)))
        staff = people
          .filter((u) => u !== null)
          .map((u) => ({ name: u.name ?? u.email, roles: u.roles.filter((role) => role !== 'athlete') }))
      }
      rows.push({
        _id: userId,
        name: r.personal.name,
        branch: r.personal.branch,
        entryCount: stats.entryCount,
        lastEntryDate: stats.lastEntryDate,
        staff,
      })
    }
    return rows
  },
})

/**
 * One member for the staff page: the registration behind the membership
 * (or, once removed, the one they left behind), whether the journal is
 * frozen, and what this reader may do in it.
 */
export const detail = query({
  args: { athleteUserId: v.id('users') },
  handler: async (ctx, args) => {
    const c = await requireAthleteAccess(ctx, args.athleteUserId)
    const registration = c.member ?? (await removedRegistrationOf(ctx, args.athleteUserId))
    if (!registration) fail('not_a_member')
    const team = await activeAssignmentsOf(ctx, args.athleteUserId)
    const people = await Promise.all(team.map((a) => ctx.db.get(a.staffUserId)))
    return {
      registration,
      frozen: c.member === null,
      account: { email: c.athlete.email },
      canComment: canCommentOn({
        permissions: permissionsOf(c.actor.roles),
        isSelf: c.isSelf,
        isAssigned: c.isAssigned,
        isMember: c.member !== null,
      }),
      team: people
        .filter((u) => u !== null)
        .map((u) => ({ _id: u._id, name: u.name ?? u.email, roles: u.roles.filter((role) => role !== 'athlete') })),
    }
  },
})
