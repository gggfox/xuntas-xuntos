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
  // The program, after selection. Appended, never reordered: `permissionsOf`
  // promises table order.
  'view_assigned_athletes',
  'view_all_athletes',
  'comment_journal',
  'manage_assignments',
  'remove_athletes',
] as const
export type Permission = (typeof PERMISSIONS)[number]

/**
 * `master_admin` is listed with everything rather than special-cased in
 * `can`: "complete access" is a fact of the table, and a reader of the
 * table should see it there.
 */
const GRANTS: Record<Role, readonly Permission[]> = {
  athlete: [],
  admin: [
    'review_registrations',
    'send_rejection',
    'view_staff',
    'view_all_athletes',
    'comment_journal',
    'manage_assignments',
    'remove_athletes',
  ],
  master_admin: PERMISSIONS,
  // A coach and a health specialist see the same things: the athletes
  // assigned to them, and nothing about anyone else.
  coach: ['view_assigned_athletes', 'comment_journal'],
  finance: [],
  health: ['view_assigned_athletes', 'comment_journal'],
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

/**
 * Anyone who has a registration to reach. Not the opposite of `isStaff`:
 * `staff.ts` keeps `athlete` when it grants a staff role, so an account can
 * be both, and one that is only staff has no "mi registro" at all.
 */
export function isAthlete(roles: readonly Role[]): boolean {
  return roles.includes('athlete')
}
