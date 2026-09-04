import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { CURRENT_CYCLE, CLOSES_AT_MS, isUnderage } from './lib/cycle'
import { validateBirthDateDeclaration } from './lib/guardianRules'
import type { AppErrorCode } from './lib/errorCodes'
import { newToken } from './lib/tokens'
import { vThemePreference } from './schema'
import { can, permissionsOf, type Permission } from './lib/permissions'

/**
 * Errors cross the wire as codes so the browser can say them in the reader's
 * language. A plain `Error` message arrives wrapped in Convex's own framing
 * and is whatever language the server happened to be written in.
 */
function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

export { newToken }

/** Authenticated user, or null. Never throws — the UI decides what to show. */
export async function currentUser(ctx: QueryCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique()
}

/** Same as `currentUser`, but requires a session. For mutations. */
export async function requireUser(ctx: QueryCtx): Promise<Doc<'users'>> {
  const user = await currentUser(ctx)
  if (!user) fail('not_signed_in')
  return user
}

export async function requirePermission(
  ctx: QueryCtx,
  permission: Permission,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (!can(user.roles, permission)) fail('permission_required')
  return user
}

/**
 * Full account status for the athlete's panel: the three axes together.
 * It is the only query the "mi registro" screen needs.
 */
export const myStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null

    const guardian = await ctx.db
      .query('guardianAuth')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', CURRENT_CYCLE))
      .unique()

    const registration = await ctx.db
      .query('registrations')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', CURRENT_CYCLE))
      .unique()

    return {
      account: {
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        roles: user.roles,
        /**
         * `false` means the account was created without a valid pre-signup and
         * we do not know their age. It does NOT mean of legal age — that
         * confusion was exactly the hole: an account without a date passed as
         * an adult and was never asked for guardian authorization.
         */
        ageDeclared: user.birthDate !== undefined,
        isMinor: user.wasMinorAtSignup ?? false,
      },
      guardian: guardian
        ? {
            required: true,
            confirmed: guardian.confirmedAt !== undefined,
            guardianEmail: guardian.guardianEmail,
            guardianName: guardian.guardianName,
            timesSent: guardian.timesSent,
            sentAt: guardian.sentAt,
          }
        : { required: false, confirmed: true as const },
      registration: registration
        ? {
            status: registration.status,
            submittedAt: registration.submittedAt,
            updatedAt: registration.updatedAt,
          }
        : null,
    }
  },
})

/**
 * Creates the guardian authorization request and schedules the email.
 *
 * It is idempotent per (user, cycle): if one already exists, it does not send
 * another. It is called by the signup and by the recovery path, and Svix
 * retries webhooks.
 */
async function openGuardianAuthorization(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    guardianName: string
    guardianEmail: string
    athleteName: string
  },
): Promise<void> {
  const alreadyExists = await ctx.db
    .query('guardianAuth')
    .withIndex('by_user_cycle', (q) => q.eq('userId', args.userId).eq('cycle', CURRENT_CYCLE))
    .unique()
  if (alreadyExists) return

  const now = Date.now()
  const token = newToken()
  await ctx.db.insert('guardianAuth', {
    userId: args.userId,
    cycle: CURRENT_CYCLE,
    guardianName: args.guardianName,
    guardianEmail: args.guardianEmail,
    token,
    expiresAt: CLOSES_AT_MS,
    sentAt: now,
    timesSent: 1,
  })
  await ctx.scheduler.runAfter(0, internal.emails.sendGuardianAuthorization, {
    to: args.guardianEmail,
    guardianName: args.guardianName,
    athleteName: args.athleteName,
    token,
    isResend: false,
  })
}

/**
 * Signup from Clerk's `user.created` webhook.
 *
 * The birth date and guardian data do NOT come from the webhook: they come
 * from the pre-signup `/empezar` created on the server, and only its token
 * travels through Clerk. The client can rewrite `unsafeMetadata`, so the only
 * thing it can forge is which pre-signup to use — and it can only use one it
 * created itself, with the age the server already computed.
 *
 * If there is no token, or it expired, the account is created ANYWAY but
 * without a date: it is left with its age undeclared and cannot submit a
 * registration until this is resolved from its panel. Before, that same
 * situation silently passed as being of legal age.
 */
export const create = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    emailVerified: v.boolean(),
    preSignupToken: v.optional(v.string()),
  },
  // Annotated on purpose: the handler calls `internal.preSignups.consume`,
  // whose type goes through `_generated/api`, which in turn includes this
  // function. Without the annotation TypeScript cannot resolve the cycle and
  // both end up as `any`.
  handler: async (ctx, args): Promise<Id<'users'>> => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    const now = Date.now()

    if (existing) {
      // `roles` is untouched here on purpose: a re-delivered webhook must
      // not reset a master_admin back to athlete. Convex owns `roles`, and
      // this mirror only ever writes it once, at insert, below.
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name ?? existing.name,
        emailVerified: args.emailVerified,
        updatedAt: now,
      })
      return existing._id
    }

    const preSignup = args.preSignupToken
      ? await ctx.runMutation(internal.preSignups.consume, {
          token: args.preSignupToken,
          clerkId: args.clerkId,
        })
      : null

    if (!preSignup) {
      console.warn(
        `[users.create] account ${args.clerkId} created without a valid pre-signup. ` +
          'It stays with its age undeclared until they complete it from their panel.',
      )
    }

    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      roles: ['athlete'],
      emailVerified: args.emailVerified,
      birthDate: preSignup?.birthDate,
      wasMinorAtSignup: preSignup?.isMinor,
      createdAt: now,
      updatedAt: now,
    })

    // Minor: the guardian email goes out immediately. It does not block the
    // signup, but the account stays incomplete until they confirm.
    if (preSignup?.isMinor && preSignup.guardianEmail && preSignup.guardianName) {
      await openGuardianAuthorization(ctx, {
        userId,
        guardianName: preSignup.guardianName,
        guardianEmail: preSignup.guardianEmail,
        athleteName: args.name ?? args.email,
      })
    }

    return userId
  },
})

/**
 * Recovery path for an account left without a birth date.
 *
 * It happens when the signup completed without a valid pre-signup — the real
 * case is the Google detour, where the token can get lost if the browser does
 * not keep sessionStorage. Without this, those accounts were stuck.
 *
 * Usable ONCE: an already-declared date cannot be changed. If it could,
 * declaring yourself an adult afterwards would be enough to get rid of the
 * guardian.
 */
export const declareBirthDate = mutation({
  args: {
    birthDate: v.string(),
    guardianName: v.optional(v.string()),
    guardianEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    if (user.birthDate !== undefined) {
      fail('birth_date_locked')
    }

    const now = Date.now()
    const birthDate = args.birthDate.trim()
    const guardianName = args.guardianName?.trim()
    const guardianEmail = args.guardianEmail?.trim().toLowerCase()

    // `user.email` is the account's verified address, which is what finally
    // enables the same-email check here: a minor naming themselves as their
    // own guardian is rejected on the server, not just in the browser.
    const problems = validateBirthDateDeclaration(
      { birthDate, guardianName, guardianEmail, ownEmail: user.email },
      now,
    )
    if (problems.length > 0) fail(problems[0].code)

    const isMinor = isUnderage(birthDate, now)

    await ctx.db.patch(user._id, {
      birthDate,
      wasMinorAtSignup: isMinor,
      updatedAt: now,
    })

    if (isMinor && guardianName && guardianEmail) {
      await openGuardianAuthorization(ctx, {
        userId: user._id,
        guardianName,
        guardianEmail,
        athleteName: user.name ?? user.email,
      })
    }

    return { ok: true as const, isMinor }
  },
})

/**
 * Stores the reader's theme.
 *
 * Deliberately trivial: no rate limit, no audit trail, nothing derived. It is
 * a display preference, and treating it with the ceremony of the registration
 * data would be miscalibrated.
 */
export const setThemePreference = mutation({
  args: { preference: vThemePreference },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await ctx.db.patch(user._id, {
      themePreference: args.preference,
      updatedAt: Date.now(),
    })
    return { ok: true as const }
  },
})

/**
 * The account's stored theme, for the header.
 *
 * The three-way return is what lets the client tell "signed out" from "signed
 * in and never chose" — a single `null` for both would make the reconciliation
 * in `ThemeSync` ambiguous, and it would push this browser's preference onto
 * an account that nobody was signed in to.
 *
 * Deliberately NOT folded into `myStatus`: that query serves the registration
 * panel, and the header runs on every page in the app.
 */
export const myThemePreference = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null
    return { preference: user.themePreference ?? null }
  },
})

/** Clerk's `user.updated`. Mirrors only; touches neither the registration nor the guardian. */
export const update = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    emailVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()
    if (!user) return
    // `roles` is untouched here for the same reason it is in `create`:
    // Clerk never owns roles, so this mirror never writes them.
    await ctx.db.patch(user._id, {
      email: args.email,
      name: args.name ?? user.name,
      emailVerified: args.emailVerified,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Clerk's `user.deleted`.
 *
 * A real delete, not a soft one: if someone exercises their cancellation
 * right under the LFPDPPP, their data actually goes away, including the
 * registration and the guardian trail.
 */
export const remove = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()
    if (!user) return

    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id))
      .collect()
    for (const r of registrations) await ctx.db.delete(r._id)

    const guardians = await ctx.db
      .query('guardianAuth')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id))
      .collect()
    for (const g of guardians) await ctx.db.delete(g._id)

    await ctx.db.delete(user._id)
  },
})

/**
 * Roles and permissions for the header and the admin guard. Separate from
 * `myStatus` for the same reason `myThemePreference` is: that query serves
 * the registration panel, and the header runs on every page.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null
    return { roles: user.roles, permissions: permissionsOf(user.roles), email: user.email }
  },
})
