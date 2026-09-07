import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { fail, currentUser, requirePermission } from './auth'
import { canBeAssigned, diffAssignments } from './lib/assignmentRules'
import { activeAssignmentsOf, membershipOf, requireAthleteAccess } from './members'

/**
 * Pairing staff with members. Administration (`manage_assignments`) writes
 * the pairs from the staff member's row; a coach never assigns themself.
 * Reading a member's team goes through the same gate as reading the
 * member — the athlete sees their own, assigned staff see it, admins all.
 */

/** A member as the picker shows them: the name and branch from the registration that made them one. */
async function memberRow(ctx: QueryCtx, athleteUserId: Id<'users'>) {
  const reg = await membershipOf(ctx, athleteUserId)
  if (!reg) return null
  return { _id: athleteUserId, name: reg.personal.name, branch: reg.personal.branch }
}

/** Only a staff member's name and roles: what a coach shows on a card, nothing the athlete cannot see anyway. */
function staffRow(u: Doc<'users'>) {
  return { _id: u._id, name: u.name ?? u.email, roles: u.roles.filter((r) => r !== 'athlete') }
}

/** Every current member, for the assign dialog's checkbox list. */
export const membersForPicker = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, 'manage_assignments')
    const selected = await ctx.db
      .query('registrations')
      .withIndex('by_status_user', (q) => q.eq('status', 'selected'))
      .collect()
    // One row per person, whichever cycle selected them last.
    const byUser = new Map<Id<'users'>, Doc<'registrations'>>()
    for (const r of selected) {
      const prev = byUser.get(r.userId)
      if (!prev || r._creationTime > prev._creationTime) byUser.set(r.userId, r)
    }
    return [...byUser.values()]
      .map((r) => ({ _id: r.userId, name: r.personal.name, branch: r.personal.branch }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  },
})

/** The members currently assigned to one staff member. */
export const forStaff = query({
  args: { staffUserId: v.id('users') },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'manage_assignments')
    const rows = await ctx.db
      .query('assignments')
      .withIndex('by_staff_active', (q) => q.eq('staffUserId', args.staffUserId).eq('endedAt', undefined))
      .collect()
    const members = await Promise.all(rows.map((a) => memberRow(ctx, a.athleteUserId)))
    return members.filter((m) => m !== null)
  },
})

/** The staff currently assigned to one member, for whoever may read that member. */
export const forAthlete = query({
  args: { athleteUserId: v.id('users') },
  handler: async (ctx, args) => {
    await requireAthleteAccess(ctx, args.athleteUserId)
    const rows = await activeAssignmentsOf(ctx, args.athleteUserId)
    const staff = await Promise.all(rows.map((a) => ctx.db.get(a.staffUserId)))
    return staff.filter((u) => u !== null).map(staffRow)
  },
})

/** The signed-in member's own team. `null` while signed out or not a member — the profile decides what to draw. */
export const myTeam = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null
    if (!(await membershipOf(ctx, user._id))) return null
    const rows = await activeAssignmentsOf(ctx, user._id)
    const staff = await Promise.all(rows.map((a) => ctx.db.get(a.staffUserId)))
    return staff.filter((u) => u !== null).map(staffRow)
  },
})

/**
 * The whole list for one staff member, as the dialog saves it: what is
 * missing gets a row, what was unticked gets ended. Rows are never deleted,
 * so a comment written under an old assignment keeps its context.
 */
export const setForStaff = mutation({
  args: { staffUserId: v.id('users'), athleteUserIds: v.array(v.id('users')) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_assignments')
    const target = await ctx.db.get(args.staffUserId)
    if (!target) fail('user_not_found')
    if (!canBeAssigned(target.roles)) fail('assignment_target_invalid')

    const active = await ctx.db
      .query('assignments')
      .withIndex('by_staff_active', (q) => q.eq('staffUserId', args.staffUserId).eq('endedAt', undefined))
      .collect()
    const { add, end } = diffAssignments(
      active.map((a) => a.athleteUserId),
      args.athleteUserIds,
    )

    // Every addition is checked before anything is written: a list with one
    // stranger in it fails whole rather than half-applying.
    for (const id of add) {
      if (!(await membershipOf(ctx, id as Id<'users'>))) fail('not_a_member')
    }

    const now = Date.now()
    for (const id of add) {
      await ctx.db.insert('assignments', {
        staffUserId: args.staffUserId,
        athleteUserId: id as Id<'users'>,
        assignedBy: actor._id,
        assignedAt: now,
      })
    }
    for (const a of active) {
      if (end.includes(a.athleteUserId)) await ctx.db.patch(a._id, { endedAt: now })
    }
    return { added: add.length, ended: end.length }
  },
})
