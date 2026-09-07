import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { fail, requireUser } from './auth'
import { canReadAthlete } from './lib/athleteAccess'
import { permissionsOf } from './lib/permissions'

/**
 * Membership, and who may look at a member. Plain functions shared by
 * `registrations.ts`, `assignments.ts` and `journal.ts`; the queries and
 * mutations that expose them to the browser live in `members.ts`'s
 * siblings, keyed by table, not here.
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
  _byId: Id<'users'>,
  now: number,
): Promise<Id<'users'>[]> {
  const active = await activeAssignmentsOf(ctx, athleteUserId)
  for (const a of active) await ctx.db.patch(a._id, { endedAt: now })
  return active.map((a) => a.staffUserId)
}
