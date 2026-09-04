/**
 * Who may do what. The only place a role is compared to anything.
 *
 * Guards read a PERMISSION, never a role: `requirePermission(ctx,
 * 'manage_cycles')` rather than `user.roles.includes('master_admin')`. When
 * finance needs the cycle screen next year, that is one entry in `GRANTS`
 * and no guard changes.
 *
 * Pure on purpose — it runs in the browser (to decide what to draw) and in
 * Convex (to decide what to allow), and it must not be able to disagree.
 */

export const ROLES = ['athlete', 'admin', 'master_admin', 'coach', 'finance', 'health'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  'review_registrations',
  'send_rejection',
  'select_registrations',
  'send_batch',
  'view_staff',
  'manage_users',
  'manage_cycles',
] as const
export type Permission = (typeof PERMISSIONS)[number]

/**
 * `master_admin` is listed with everything rather than special-cased in
 * `can`: "complete access" is a fact of the table, and a reader of the
 * table should see it there.
 */
const GRANTS: Record<Role, readonly Permission[]> = {
  athlete: [],
  admin: ['review_registrations', 'send_rejection', 'view_staff'],
  master_admin: PERMISSIONS,
  coach: [],
  finance: [],
  health: [],
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function can(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => GRANTS[r].includes(permission))
}

/** In table order, so two lists compare with `toEqual`. */
export function permissionsOf(roles: readonly Role[]): Permission[] {
  return PERMISSIONS.filter((p) => can(roles, p))
}

/** Anyone with a role that is not `athlete`. Decides which header to draw. */
export function isStaff(roles: readonly Role[]): boolean {
  return roles.some((r) => r !== 'athlete')
}
