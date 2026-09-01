import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import { isUnderage } from './lib/cycle'
import { validateBirthDateDeclaration } from './lib/guardianRules'
import type { AppErrorCode } from './lib/errorCodes'
import { newToken } from './lib/tokens'

/**
 * Errors cross the wire as codes so the browser can say them in the reader's
 * language. A plain `Error` message arrives wrapped in Convex's own framing
 * and is whatever language the server happened to be written in.
 */
function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

/**
 * Age gate, resolved on the server before the account exists.
 *
 * The browser never decides whether someone is a minor nor stores their birth
 * date: it sends the date once, the server computes `isMinor`, and only an
 * opaque token travels back. That token is the only thing that goes through
 * Clerk's `unsafeMetadata` — which the client can rewrite, and that is why it
 * no longer carries anything that matters.
 */

/**
 * Two hours. It is more than enough to create an account (including the
 * Google detour) and it is not long to be holding the birth date of a minor
 * and the email of her guardian without anyone having consented yet.
 */
const TTL_MS = 2 * 60 * 60 * 1000

export const create = mutation({
  args: {
    birthDate: v.string(),
    guardianName: v.optional(v.string()),
    guardianEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const birthDate = args.birthDate.trim()

    const guardianName = args.guardianName?.trim()
    const guardianEmail = args.guardianEmail?.trim().toLowerCase()

    // No account exists yet, so there is no own-email to compare against and
    // that part of the rule simply does not apply on this path.
    const problems = validateBirthDateDeclaration(
      { birthDate, guardianName, guardianEmail },
      now,
    )
    if (problems.length > 0) fail(problems[0].code)

    // THE decision. It is made here and nowhere else.
    const isMinor = isUnderage(birthDate, now)

    const token = newToken()
    await ctx.db.insert('preSignups', {
      token,
      birthDate,
      isMinor,
      // If not a minor, nothing about the guardian is stored, even if it was sent.
      guardianName: isMinor ? guardianName : undefined,
      guardianEmail: isMinor ? guardianEmail : undefined,
      createdAt: now,
      expiresAt: now + TTL_MS,
    })

    // `isMinor` is returned only so the next screen knows what to say.
    // The row we just wrote is the authority.
    return { token, isMinor }
  },
})

/**
 * Consumed by the `user.created` webhook. Single use: if the same token
 * arrives twice (Svix retries), the second one finds nothing to consume and
 * the signup goes on its way without duplicating the guardian request.
 */
/** What the signup needs to know about an already-resolved pre-signup. */
export type ResolvedPreSignup = {
  birthDate: string
  isMinor: boolean
  guardianName?: string
  guardianEmail?: string
}

export const consume = internalMutation({
  args: { token: v.string(), clerkId: v.string() },
  // Annotated on purpose: without this, `users.create` calls it, the type goes
  // through `_generated/api` and TypeScript ends up unable to infer either of the two.
  handler: async (ctx, args): Promise<ResolvedPreSignup | null> => {
    const preSignup = await ctx.db
      .query('preSignups')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!preSignup) return null
    if (preSignup.usedBy !== undefined && preSignup.usedBy !== args.clerkId) return null
    if (Date.now() > preSignup.expiresAt) return null

    if (preSignup.usedBy === undefined) {
      await ctx.db.patch(preSignup._id, { usedBy: args.clerkId })
    }

    return {
      birthDate: preSignup.birthDate,
      isMinor: preSignup.isMinor,
      guardianName: preSignup.guardianName,
      guardianEmail: preSignup.guardianEmail,
    }
  },
})

/**
 * Sweep of expired pre-signups. Run by the cron.
 *
 * They are personal data of minors that nobody ever got to use. There is no
 * reason to keep them and there is reason not to.
 */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('preSignups')
      .withIndex('by_expires', (q) => q.lt('expiresAt', Date.now()))
      .take(500)

    for (const p of expired) await ctx.db.delete(p._id)

    if (expired.length > 0) {
      console.log(`[preSignups] deleted ${expired.length} expired pre-signups`)
    }
    return expired.length
  },
})
