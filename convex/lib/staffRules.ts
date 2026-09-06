import type { AppErrorCode } from './errorCodes'
import { isValidEmail } from './html'
import { ROLES, isRole, type Role } from './permissions'

/**
 * The rules of inviting and removing staff, as pure functions returning
 * codes. `convex/staff.ts` calls them before writing; the invite form calls
 * them for immediate feedback.
 */

/** Seven days. Long enough to be read on a Monday and acted on Friday. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Same brake as the guardian email: this is a way to make the domain send mail. */
export const INVITE_RESEND_WAIT_MS = 5 * 60 * 1000

export type StaffRole = Exclude<Role, 'athlete'>

/** Dedupes, drops `athlete` and anything unknown, keeps table order. */
export function normalizeStaffRoles(roles: readonly unknown[]): StaffRole[] {
  const wanted = new Set(roles.filter(isRole))
  return ROLES.filter((r): r is StaffRole => r !== 'athlete' && wanted.has(r))
}

export function validateInvite(input: {
  email: string
  roles: readonly unknown[]
}): AppErrorCode | null {
  if (!isValidEmail(input.email.trim().toLowerCase())) return 'invite_email_invalid'
  if (normalizeStaffRoles(input.roles).length === 0) return 'invite_roles_invalid'
  return null
}

export type InviteStatus = 'pending' | 'expired' | 'accepted' | 'revoked'

/** Accepted and revoked outrank expiry: they are things people did. */
export function inviteStatus(
  invite: { expiresAt: number; acceptedAt?: number; revokedAt?: number },
  now: number,
): InviteStatus {
  if (invite.acceptedAt !== undefined) return 'accepted'
  if (invite.revokedAt !== undefined) return 'revoked'
  if (now > invite.expiresAt) return 'expired'
  return 'pending'
}

/**
 * The two ways to lock XUNTAS out of its own panel, refused here.
 *
 * `masterAdminCount` is how many accounts hold `master_admin` BEFORE the
 * change, the target included.
 */
export function checkRoleChange(input: {
  actorId: string
  actorRoles: readonly Role[]
  targetId: string
  targetRoles: readonly Role[]
  nextRoles: readonly Role[]
  masterAdminCount: number
}): AppErrorCode | null {
  const losesMaster =
    input.targetRoles.includes('master_admin') && !input.nextRoles.includes('master_admin')
  if (!losesMaster) return null
  if (input.targetId === input.actorId) return 'cannot_remove_own_master_admin'
  if (input.masterAdminCount <= 1) return 'cannot_remove_last_master_admin'
  return null
}
