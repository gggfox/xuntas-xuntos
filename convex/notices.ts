import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { internal } from './_generated/api'
import type { AppErrorCode } from './lib/errorCodes'
import { isWindowOpenFor } from './lib/cycleRules'
import { requirePermission } from './auth'

/**
 * Sending the three decision emails. `emails.ts` owns the copy and the
 * per-registration send; this module owns who may trigger it, and the two
 * safety nets that matter for mail that cannot be recalled: a batch refuses
 * while the cycle's window is open, and nothing here can send the same
 * notice twice.
 */

function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

const vNoticeDecision = v.union(v.literal('rejected'), v.literal('selected'), v.literal('not_selected'))

/** One rejection, any time. Screening a person out early is a kindness, not a batch. */
export const sendRejection = mutation({
  args: { id: v.id('registrations') },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'send_rejection')
    const r = await ctx.db.get(args.id)
    if (!r) fail('registration_not_found')
    if (r.decisionNotice?.decision !== 'rejected') fail('decision_invalid')
    if (r.decisionNotice.status !== 'not_sent') fail('notice_not_pending')
    await ctx.scheduler.runAfter(0, internal.emails.sendDecisionNotice, {
      registrationId: r._id,
      sentBy: actor._id,
    })
    return { ok: true as const }
  },
})

/**
 * The Council's results. Refused while the cycle's window is open — nobody
 * gets "selected" while others are still submitting — and skips anything
 * not pending, so pressing the button twice sends nothing twice.
 */
export const sendBatch = mutation({
  args: { cycle: v.string(), ids: v.array(v.id('registrations')) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'send_batch')
    const cycle = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', args.cycle))
      .unique()
    if (!cycle) fail('cycle_not_found')
    // The batch's own cycle decides, not whichever cycle happens to be
    // active — a stale batch for a past cycle must not be blocked by, and a
    // batch for the active cycle must not be let through by, someone else's
    // window.
    if (isWindowOpenFor(cycle)) fail('window_open')

    let sent = 0
    let skipped = 0
    for (const id of args.ids) {
      const r = await ctx.db.get(id)
      if (!r || r.cycle !== args.cycle || !r.decisionNotice || r.decisionNotice.status !== 'not_sent') {
        skipped++
        continue
      }
      await ctx.scheduler.runAfter(0, internal.emails.sendDecisionNotice, {
        registrationId: r._id,
        sentBy: actor._id,
      })
      sent++
    }
    if (sent === 0) fail('nothing_to_send')
    return { sent, skipped }
  },
})

/** The body, to the actor's own address only. What stops a typo going to two hundred families. */
export const sendTest = mutation({
  args: { cycle: v.string(), decision: vNoticeDecision },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, args.decision === 'rejected' ? 'send_rejection' : 'send_batch')
    await ctx.scheduler.runAfter(0, internal.emails.sendDecisionTest, {
      to: actor.email,
      decision: args.decision,
      cycle: args.cycle,
    })
    return { ok: true as const }
  },
})
