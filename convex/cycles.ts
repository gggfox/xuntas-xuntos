import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { AppErrorCode } from './lib/errorCodes'
import { isWindowOpenFor, validateCycle, windowOf, type CycleFields } from './lib/cycleRules'
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
  title: c.title,
})

/** One `cycleChanges` row per write, so every move of the window leaves a trail. */
async function record(
  ctx: MutationCtx,
  by: Doc<'users'>,
  cycle: Id<'cycles'>,
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

/** A duplicate title, case- and whitespace-insensitive, excluding one row (for `update`). */
async function titleTaken(
  ctx: MutationCtx,
  title: string,
  excluding?: Id<'cycles'>,
): Promise<boolean> {
  const rows = await ctx.db.query('cycles').collect()
  const normalized = title.trim().toLowerCase()
  return rows.some((r) => r._id !== excluding && r.title.trim().toLowerCase() === normalized)
}

/**
 * The 2026–2027 row, with the dates the constants used to hold. Idempotent:
 * a deployment that already has ANY cycle row is left alone, since a call
 * has no name to look up a duplicate by. Run once per deployment BEFORE the
 * code that reads it deploys:
 *
 *   pnpm convex run cycles:seed
 *   pnpm convex run cycles:seed --prod
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('cycles').first()
    if (existing) return { inserted: false, activated: false }

    const now = Date.now()
    await ctx.db.insert('cycles', {
      title: 'Convocatoria General 2026–2027',
      opensOn: '2026-09-04',
      closesOn: '2026-09-18',
      reviewOn: '2026-09-23',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    return { inserted: true, activated: true }
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
      _id: row._id,
      title: row.title,
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
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => ({
        _id: c._id,
        title: c.title,
        opensOn: c.opensOn,
        closesOn: c.closesOn,
        reviewOn: c.reviewOn,
        isActive: c.isActive,
        updatedAt: c.updatedAt,
      }))
  },
})

export const changes = query({
  args: { cycle: v.id('cycles') },
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
  title: v.string(),
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
    if (await titleTaken(ctx, args.title)) fail('cycle_title_taken')

    const now = Date.now()
    const fields: CycleFields = {
      title: args.title.trim(),
      opensOn: args.opensOn,
      closesOn: args.closesOn,
      reviewOn: args.reviewOn,
      // Never active on creation: activating is its own, deliberate action.
      isActive: false,
    }
    const id = await ctx.db.insert('cycles', {
      ...fields,
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    })
    await record(ctx, actor, id, null, fields)
    return { ok: true as const }
  },
})

export const update = mutation({
  args: { id: v.id('cycles'), ...vInput },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_cycles')
    const problem = validateCycle(args)
    if (problem) fail(problem)
    const row = await ctx.db.get(args.id)
    if (!row) fail('cycle_not_found')
    if (await titleTaken(ctx, args.title, row._id)) fail('cycle_title_taken')

    const after: CycleFields = {
      ...fieldsOf(row),
      title: args.title.trim(),
      opensOn: args.opensOn,
      closesOn: args.closesOn,
      reviewOn: args.reviewOn,
    }
    await ctx.db.patch(row._id, { ...after, updatedAt: Date.now() })
    await record(ctx, actor, row._id, fieldsOf(row), after)
    return { ok: true as const }
  },
})

/** One transaction: the previous active goes off, the target goes on, one trail row each. */
export const setActive = mutation({
  args: { cycle: v.id('cycles') },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_cycles')
    const target = await ctx.db.get(args.cycle)
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
      await record(ctx, actor, current._id, fieldsOf(current), after)
    }
    const after = { ...fieldsOf(target), isActive: true }
    await ctx.db.patch(target._id, { isActive: true, updatedAt: now })
    await record(ctx, actor, target._id, fieldsOf(target), after)
    return { ok: true as const }
  },
})
