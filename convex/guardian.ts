import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { CURRENT_CYCLE, CLOSES_AT_MS } from './lib/cycle'
import { requireUser, newToken } from './users'
import { isValidEmail } from './lib/html'
import type { AppErrorCode } from './lib/errorCodes'

/**
 * Errors cross the wire as codes so the browser can say them in the reader's
 * language. A plain `Error` message arrives wrapped in Convex's own framing
 * and is whatever language the server happened to be written in.
 */
function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}


/** Minimum wait between resends, so we do not burn the domain's reputation. */
const RESEND_WAIT_MS = 5 * 60 * 1000

/**
 * Hard cap on emails to the guardian per cycle. A guardian who does not
 * answer after ten attempts is not a delivery problem: a person resolves it.
 */
const MAX_SENDS = 10

const NAME_LIMIT = 120

/**
 * Resolves the token from the email link. Public on purpose: whoever opens it
 * is the guardian, who has no account. The token is the credential.
 */
export const getRequest = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query('guardianAuth')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!auth) return { status: 'invalid' as const }
    if (auth.confirmedAt !== undefined) return { status: 'already_confirmed' as const }
    if (Date.now() > auth.expiresAt) return { status: 'expired' as const }

    const athlete = await ctx.db.get(auth.userId)
    return {
      status: 'pending' as const,
      guardianName: auth.guardianName,
      athleteName: athlete?.name ?? 'la persona registrada',
    }
  },
})

/**
 * The guardian authorizes. Single use.
 *
 * A registration is never auto-rejected for lack of authorization — if the
 * link expires, a person resolves it. See docs/DECISIONS.md.
 */
export const confirm = mutation({
  args: { token: v.string(), userAgent: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query('guardianAuth')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!auth) return { ok: false as const, reason: 'invalid' as const }
    if (auth.confirmedAt !== undefined) return { ok: true as const, reason: 'already_confirmed' as const }
    if (Date.now() > auth.expiresAt) return { ok: false as const, reason: 'expired' as const }

    await ctx.db.patch(auth._id, {
      confirmedAt: Date.now(),
      confirmedFrom: args.userAgent,
    })

    const athlete = await ctx.db.get(auth.userId)
    return { ok: true as const, reason: 'confirmed' as const, athleteName: athlete?.name }
  },
})

/** The athlete resends the email to their guardian from their panel. */
export const resend = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)

    const auth = await ctx.db
      .query('guardianAuth')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', CURRENT_CYCLE))
      .unique()

    if (!auth) fail('guardian_not_required')
    if (auth.confirmedAt !== undefined) return { ok: true as const, reason: 'already_confirmed' as const }

    const now = Date.now()
    if (now - auth.sentAt < RESEND_WAIT_MS) {
      return { ok: false as const, reason: 'wait' as const, availableAt: auth.sentAt + RESEND_WAIT_MS }
    }
    if (auth.timesSent >= MAX_SENDS) {
      return { ok: false as const, reason: 'too_many' as const }
    }

    // A new token on every resend: the previous one stops working.
    const token = newToken()
    await ctx.db.patch(auth._id, {
      token,
      expiresAt: CLOSES_AT_MS,
      sentAt: now,
      timesSent: auth.timesSent + 1,
    })

    await ctx.scheduler.runAfter(0, internal.emails.sendGuardianAuthorization, {
      to: auth.guardianEmail,
      guardianName: auth.guardianName,
      athleteName: user.name ?? user.email,
      token,
      isResend: true,
    })

    return { ok: true as const, reason: 'sent' as const }
  },
})

/**
 * The athlete corrects the guardian's email (it was mistyped, it bounced,
 * etc.).
 *
 * It carries the same brake as `resend`. Without it, this mutation was a way
 * to send unlimited emails from the XUNTAS domain to any address: just change
 * the guardian's email over and over.
 */
export const correctEmail = mutation({
  args: { guardianName: v.string(), guardianEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const guardianName = args.guardianName.trim()
    const guardianEmail = args.guardianEmail.trim().toLowerCase()

    if (!guardianName) fail('guardian_name_required')
    if (guardianName.length > NAME_LIMIT) fail('guardian_name_too_long')
    if (!isValidEmail(guardianEmail)) fail('guardian_email_invalid')

    const auth = await ctx.db
      .query('guardianAuth')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', CURRENT_CYCLE))
      .unique()

    if (!auth) fail('guardian_not_required')
    if (auth.confirmedAt !== undefined) fail('guardian_already_confirmed')

    const now = Date.now()
    const unchanged = auth.guardianEmail === guardianEmail && auth.guardianName === guardianName

    // Correcting to the same data is a resend in disguise: same brake.
    if (unchanged && now - auth.sentAt < RESEND_WAIT_MS) {
      return {
        ok: false as const,
        reason: 'wait' as const,
        availableAt: auth.sentAt + RESEND_WAIT_MS,
      }
    }
    if (auth.timesSent >= MAX_SENDS) {
      return { ok: false as const, reason: 'too_many' as const }
    }

    const token = newToken()
    await ctx.db.patch(auth._id, {
      guardianName,
      guardianEmail,
      token,
      expiresAt: CLOSES_AT_MS,
      sentAt: now,
      timesSent: auth.timesSent + 1,
    })

    await ctx.scheduler.runAfter(0, internal.emails.sendGuardianAuthorization, {
      to: guardianEmail,
      guardianName,
      athleteName: user.name ?? user.email,
      token,
      isResend: false,
    })

    return { ok: true as const, reason: 'sent' as const }
  },
})
