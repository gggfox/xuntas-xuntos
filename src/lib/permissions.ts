/**
 * Re-exports the permission table from the backend, the way `cycle.ts` and
 * `registrationRules.ts` do: the browser decides what to draw from the same
 * table Convex decides what to allow from.
 */
export {
  PERMISSIONS,
  ROLES,
  can,
  isRole,
  isStaff,
  permissionsOf,
  type Permission,
  type Role,
} from '../../convex/lib/permissions'
