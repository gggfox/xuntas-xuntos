import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import type { Doc } from './_generated/dataModel'
import type { AppErrorCode } from './lib/errorCodes'
import {
  isWindowOpenFor,
  validateCycle,
  windowOf,
  type CycleFields,
} from './lib/cycleRules'
import { currentUser, requirePermission } from './auth'
import { can } from './lib/permissions'

function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

/** The one call athletes register into. Every other module reads it through here. */
export async function activeCycle(ctx: QueryCtx): Promise<Doc<'cycles'>> {
  const row = await ctx.db
    .query('cycles')
    .withIndex('by_active', (q) => q.eq('isActive', true))
    .unique()
  if (!row) fail('no_active_cycle')
  return row
}

/** Frozen outside the window. Applies to draft and to submitted alike. */
export async function requireWindowOpen(ctx: QueryCtx): Promise<Doc<'cycles'>> {
  const row = await activeCycle(ctx)
  if (!isWindowOpenFor(row)) fail('window_closed')
  return row
}

const fieldsOf = (c: Doc<'cycles'>): CycleFields => ({
  opensOn: c.opensOn,
  closesOn: c.closesOn,
  reviewOn: c.reviewOn,
  isActive: c.isActive,
})

/** One `cycleChanges` row per write, so every move of the window leaves a trail. */
async function record(
  ctx: MutationCtx,
  by: Doc<'users'>,
  cycle: string,
  before: CycleFields | null,
  after: CycleFields,
): Promise<void> {
  await ctx.db.insert('cycleChanges', {
    cycle,
    changedBy: by._id,
    changedAt: Date.now(),
    before,
    after,
  })
}

/**
 * The 2026–2027 row, from the values the constants used to hold. Idempotent.
 * Run once per deployment BEFORE the code that reads it deploys:
 *
 *   npx convex run cycles:seed
 *   npx convex run cycles:seed --prod
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', '2026-2027'))
      .unique()
    if (existing) return { inserted: false, activated: false }

    // `by_active` is a `.unique()` index: a second active row does not sit
    // beside the first, it takes every query on that index down. This can
    // run against a deployment that already has a different cycle active
    // (a second environment reusing this seed, a re-run after `create` and
    // `setActive` moved on) — in that case the invariant "at most one active
    // row" wins over "the seeded row starts active", so it lands inactive
    // and a person promotes it with `setActive` if that is what they want.
    const activeElsewhere = await ctx.db
      .query('cycles')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .unique()
    const now = Date.now()
    await ctx.db.insert('cycles', {
      cycle: '2026-2027',
      opensOn: '2026-09-04',
      closesOn: '2026-09-18',
      reviewOn: '2026-09-23',
      isActive: activeElsewhere === null,
      createdAt: now,
      updatedAt: now,
    })
    return { inserted: true, activated: activeElsewhere === null }
  },
})

/** Public: the landing page reads it signed out. */
export const active = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('cycles')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .unique()
    if (!row) return null
    const { opensAtMs, closesAtMs } = windowOf(row)
    const now = Date.now()
    return {
      cycle: row.cycle,
      opensOn: row.opensOn,
      closesOn: row.closesOn,
      reviewOn: row.reviewOn,
      opensAtMs,
      closesAtMs,
      isOpen: now >= opensAtMs && now <= closesAtMs,
      beforeOpening: now < opensAtMs,
    }
  },
})

/** Staff list: reviewers need to see the window even though they cannot move it. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user || !(can(user.roles, 'manage_cycles') || can(user.roles, 'review_registrations'))) {
      fail('permission_required')
    }
    const rows = await ctx.db.query('cycles').collect()
    return rows
      .sort((a, b) => b.cycle.localeCompare(a.cycle))
      .map((c) => ({
        _id: c._id,
        cycle: c.cycle,
        opensOn: c.opensOn,
        closesOn: c.closesOn,
        reviewOn: c.reviewOn,
        isActive: c.isActive,
        updatedAt: c.updatedAt,
      }))
  },
})

export const changes = query({
  args: { cycle: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'manage_cycles')
    const rows = await ctx.db
      .query('cycleChanges')
      .withIndex('by_cycle', (q) => q.eq('cycle', args.cycle))
      .collect()
    const out = []
    for (const r of rows.sort((a, b) => b.changedAt - a.changedAt)) {
      const by = await ctx.db.get(r.changedBy)
      out.push({
        changedAt: r.changedAt,
        changedByName: by?.name ?? by?.email ?? '',
        before: r.before,
        after: r.after,
      })
    }
    return out
  },
})

const vInput = {
  cycle: v.string(),
  opensOn: v.string(),
  closesOn: v.string(),
  reviewOn: v.string(),
}

export const create = mutation({
  args: vInput,
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_cycles')
    const problem = validateCycle(args)
    if (problem) fail(problem)
    const cycle = args.cycle.trim()
    const dup = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', cycle))
      .unique()
    if (dup) fail('cycle_exists')

    const now = Date.now()
    const fields: CycleFields = {
      opensOn: args.opensOn,
      closesOn: args.closesOn,
      reviewOn: args.reviewOn,
      // Never active on creation: activating is its own, deliberate action.
      isActive: false,
    }
    await ctx.db.insert('cycles', {
      cycle,
      ...fields,
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    })
    await record(ctx, actor, cycle, null, fields)
    return { ok: true as const }
  },
})

export const update = mutation({
  args: vInput,
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_cycles')
    const problem = validateCycle(args)
    if (problem) fail(problem)
    const row = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', args.cycle.trim()))
      .unique()
    if (!row) fail('cycle_not_found')

    const after: CycleFields = {
      ...fieldsOf(row),
      opensOn: args.opensOn,
      closesOn: args.closesOn,
      reviewOn: args.reviewOn,
    }
    await ctx.db.patch(row._id, { ...after, updatedAt: Date.now() })
    await record(ctx, actor, row.cycle, fieldsOf(row), after)
    return { ok: true as const }
  },
})

/** One transaction: the previous active goes off, the target goes on, one trail row each. */
export const setActive = mutation({
  args: { cycle: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_cycles')
    const target = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', args.cycle.trim()))
      .unique()
    if (!target) fail('cycle_not_found')
    if (target.isActive) return { ok: true as const }

    const now = Date.now()
    const current = await ctx.db
      .query('cycles')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .unique()
    if (current) {
      const after = { ...fieldsOf(current), isActive: false }
      await ctx.db.patch(current._id, { isActive: false, updatedAt: now })
      await record(ctx, actor, current.cycle, fieldsOf(current), after)
    }
    const after = { ...fieldsOf(target), isActive: true }
    await ctx.db.patch(target._id, { isActive: true, updatedAt: now })
    await record(ctx, actor, target.cycle, fieldsOf(target), after)
    return { ok: true as const }
  },
})
