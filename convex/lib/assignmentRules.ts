import { can, type Role } from './permissions'

/**
 * The rules of pairing staff with members, as pure functions. `assignments.ts`
 * runs them before writing; the assign dialog runs `canBeAssigned` to decide
 * which staff rows get the button at all.
 */

/**
 * Only someone whose access is "assigned athletes" — and nothing wider —
 * can have athletes assigned. Administration already sees everyone, so a
 * list for them would be a list that changes nothing.
 */
export function canBeAssigned(roles: readonly Role[]): boolean {
  return can(roles, 'view_assigned_athletes') && !can(roles, 'view_all_athletes')
}

/**
 * What a saved checkbox list means in writes: the ids to add and the ids
 * to end. Order-insensitive; a repeated id counts once.
 */
export function diffAssignments(
  current: readonly string[],
  wanted: readonly string[],
): { add: string[]; end: string[] } {
  const have = new Set(current)
  const want = new Set(wanted)
  return {
    add: [...want].filter((id) => !have.has(id)),
    end: [...have].filter((id) => !want.has(id)),
  }
}
