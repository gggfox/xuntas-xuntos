import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import type { AppErrorCode } from './lib/errorCodes'
import type { Role } from './lib/permissions'
import {
  INVITE_RESEND_WAIT_MS,
  INVITE_TTL_MS,
  checkRoleChange,
  inviteStatus,
  normalizeStaffRoles,
  validateInvite,
} from './lib/staffRules'
import { newToken } from './lib/tokens'
import { requirePermission } from './users'

/**
 * Errors cross the wire as codes so the browser can say them in the reader's
 * language. A plain `Error` message arrives wrapped in Convex's own framing
 * and is whatever language the server happened to be written in.
 */
function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

const vRoles = v.array(v.string())

async function masterAdminCount(ctx: QueryCtx): Promise<number> {
  const users = await ctx.db.query('users').collect()
  return users.filter((u) => u.roles.includes('master_admin')).length
}

/**
 * Grants without an invitation. Two callers: the CLI bootstrap of the first
 * master_admin, and `invite` when the email already has an account. The
 * athlete role, if present, stays: someone who registered and later joins
 * the staff has not stopped being a registrant.
 */
async function grant(ctx: MutationCtx, user: Doc<'users'>, roles: readonly Role[]): Promise<Role[]> {
  const keepAthlete = user.roles.includes('athlete') ? (['athlete'] as const) : []
  const next = [...keepAthlete, ...normalizeStaffRoles(roles)]
  await ctx.db.patch(user._id, { roles: next, updatedAt: Date.now() })
  return next
}

/**
 * Bootstrap. Run by hand, once per deployment:
 *
 *   npx convex run staff:grantRoles '{"email":"…","roles":["master_admin"]}'
 *   npx convex run staff:grantRoles '{"email":"…","roles":["master_admin"]}' --prod
 */
export const grantRoles = internalMutation({
  args: { email: v.string(), roles: vRoles },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email.trim().toLowerCase()))
      .unique()
    if (!user) fail('user_not_found')
    const roles = await grant(ctx, user, normalizeStaffRoles(args.roles))
    console.log(`[staff.grantRoles] ${user.email} → ${roles.join(', ')}`)
    return { userId: user._id }
  },
})

export const invite = mutation({
  args: { email: v.string(), roles: vRoles },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_users')
    const problem = validateInvite(args)
    if (problem) fail(problem)

    const email = args.email.trim().toLowerCase()
    const roles = normalizeStaffRoles(args.roles)
    const now = Date.now()

    // An account already exists: grant directly. An invite link for someone
    // who already signs in is friction that teaches nothing.
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique()
    if (existing) {
      const next = await grant(ctx, existing, [...existing.roles, ...roles])
      await ctx.scheduler.runAfter(0, internal.emails.sendAccessGranted, {
        to: email,
        roles: next.filter((r) => r !== 'athlete'),
      })
      return { kind: 'granted' as const }
    }

    // A pending invite to the same address is replaced, not duplicated: the
    // newest roles win and the old link stops working.
    const pending = (
      await ctx.db
        .query('staffInvites')
        .withIndex('by_email', (q) => q.eq('email', email))
        .collect()
    ).filter((i) => inviteStatus(i, now) === 'pending')
    for (const p of pending) await ctx.db.patch(p._id, { revokedAt: now })

    const token = newToken()
    await ctx.db.insert('staffInvites', {
      email,
      roles,
      token,
      invitedBy: actor._id,
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
      lastSentAt: now,
      timesSent: 1,
    })
    await ctx.scheduler.runAfter(0, internal.emails.sendStaffInvitation, {
      to: email,
      inviterName: actor.name ?? actor.email,
      roles,
      token,
    })
    return { kind: 'invited' as const }
  },
})

export const resendInvite = mutation({
  args: { inviteId: v.id('staffInvites') },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_users')
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) fail('invite_invalid')
    const now = Date.now()
    const status = inviteStatus(invite, now)
    if (status === 'accepted') fail('invite_accepted')
    if (status === 'revoked') fail('invite_revoked')
    if (now - invite.lastSentAt < INVITE_RESEND_WAIT_MS) fail('invite_wait')

    // A new token on every resend, and a fresh week: the old link stops working.
    const token = newToken()
    await ctx.db.patch(invite._id, {
      token,
      expiresAt: now + INVITE_TTL_MS,
      lastSentAt: now,
      timesSent: invite.timesSent + 1,
    })
    await ctx.scheduler.runAfter(0, internal.emails.sendStaffInvitation, {
      to: invite.email,
      inviterName: actor.name ?? actor.email,
      roles: invite.roles,
      token,
    })
    return { ok: true as const }
  },
})

export const revokeInvite = mutation({
  args: { inviteId: v.id('staffInvites') },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'manage_users')
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) fail('invite_invalid')
    if (inviteStatus(invite, Date.now()) === 'pending') {
      await ctx.db.patch(invite._id, { revokedAt: Date.now() })
    }
    return { ok: true as const }
  },
})

/**
 * Edits a staff account's roles. Passing no staff roles is the "remove"
 * action: the account stays (with `athlete` if it had it), the person just
 * cannot get in. No email — see docs/DECISIONS.md.
 */
export const setRoles = mutation({
  args: { userId: v.id('users'), roles: vRoles },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_users')
    const target = await ctx.db.get(args.userId)
    if (!target) fail('user_not_found')

    const keepAthlete = target.roles.includes('athlete') ? (['athlete'] as const) : []
    const next: Role[] = [...keepAthlete, ...normalizeStaffRoles(args.roles)]

    const problem = checkRoleChange({
      actorId: actor._id,
      actorRoles: actor.roles,
      targetId: target._id,
      targetRoles: target.roles,
      nextRoles: next,
      masterAdminCount: await masterAdminCount(ctx),
    })
    if (problem) fail(problem)

    await ctx.db.patch(target._id, { roles: next, updatedAt: Date.now() })
    return { ok: true as const }
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, 'view_staff')
    const now = Date.now()

    const users = await ctx.db.query('users').collect()
    const staff = users
      .filter((u) => u.roles.some((r) => r !== 'athlete'))
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        roles: u.roles.filter((r) => r !== 'athlete'),
      }))

    const invites = await ctx.db.query('staffInvites').collect()
    const byId = new Map(users.map((u) => [u._id, u]))
    return {
      staff,
      invites: invites.map((i) => {
        const by = byId.get(i.invitedBy)
        return {
          _id: i._id,
          email: i.email,
          roles: i.roles,
          status: inviteStatus(i, now),
          expiresAt: i.expiresAt,
          lastSentAt: i.lastSentAt,
          invitedByName: by?.name ?? by?.email ?? '',
        }
      }),
    }
  },
})

/**
 * Resolves the link. Public: the invitee has no account yet. It reveals the
 * invited email, which the holder of the link already knows.
 */
export const getInvite = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query('staffInvites')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()
    if (!invite) return { status: 'invalid' as const }
    const status = inviteStatus(invite, Date.now())
    if (status !== 'pending') return { status }
    const by = await ctx.db.get(invite.invitedBy)
    return {
      status,
      email: invite.email,
      roles: invite.roles,
      invitedByName: by?.name ?? by?.email ?? '',
    }
  },
})
