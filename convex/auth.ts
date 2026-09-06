import { ConvexError } from 'convex/values'
import type { QueryCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import type { AppErrorCode } from './lib/errorCodes'
import { can, type Permission } from './lib/permissions'

/**
 * Who is signed in, and what they may do. Split out of `users.ts` because
 * `cycles.ts` needs `requirePermission` and `users.ts` needs `activeCycle`
 * from `cycles.ts` — two modules that both import each other cannot resolve,
 * so the shared bottom (auth, not any one table) lives here instead.
 */

/**
 * Errors cross the wire as codes so the browser can say them in the reader's
 * language. A plain `Error` message arrives wrapped in Convex's own framing
 * and is whatever language the server happened to be written in.
 */
export function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

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
