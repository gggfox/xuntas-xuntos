import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  ROLES,
  can,
  isRole,
  isStaff,
  permissionsOf,
} from '../convex/lib/permissions'

describe('the permission table', () => {
  it('gives admin the review permissions and nothing that manages people or dates', () => {
    expect(can(['admin'], 'review_registrations')).toBe(true)
    expect(can(['admin'], 'send_rejection')).toBe(true)
    expect(can(['admin'], 'view_staff')).toBe(true)
    expect(can(['admin'], 'select_registrations')).toBe(false)
    expect(can(['admin'], 'send_batch')).toBe(false)
    expect(can(['admin'], 'manage_users')).toBe(false)
    expect(can(['admin'], 'manage_cycles')).toBe(false)
  })

  /** Administration sees every member's journal and runs the team; it never needs the "assigned only" view. */
  it('gives admin the whole program: every journal, assignments, and removal', () => {
    expect(can(['admin'], 'view_all_athletes')).toBe(true)
    expect(can(['admin'], 'comment_journal')).toBe(true)
    expect(can(['admin'], 'manage_assignments')).toBe(true)
    expect(can(['admin'], 'remove_athletes')).toBe(true)
    expect(can(['admin'], 'view_assigned_athletes')).toBe(false)
  })

  it('lets coach and health see and comment on assigned athletes only', () => {
    for (const role of ['coach', 'health'] as const) {
      expect(permissionsOf([role])).toEqual(['view_assigned_athletes', 'comment_journal'])
    }
    expect(permissionsOf(['coach', 'health'])).toEqual(permissionsOf(['coach']))
  })

  /** "Complete access to everything": a missing checkbox must never lock a master_admin out. */
  it('makes master_admin a superset of every permission', () => {
    for (const p of PERMISSIONS) expect(can(['master_admin'], p)).toBe(true)
  })

  it('grants nothing to athletes and to finance, which still has no screen', () => {
    for (const role of ['athlete', 'finance'] as const) {
      expect(permissionsOf([role])).toEqual([])
    }
  })

  it('unions permissions across roles', () => {
    expect(permissionsOf(['athlete', 'admin'])).toEqual(permissionsOf(['admin']))
  })

  it('lists permissions in table order, without duplicates', () => {
    expect(permissionsOf(['admin', 'master_admin'])).toEqual([...PERMISSIONS])
  })
})

describe('isStaff', () => {
  it('is anyone with a role other than athlete', () => {
    expect(isStaff(['athlete'])).toBe(false)
    expect(isStaff([])).toBe(false)
    expect(isStaff(['coach'])).toBe(true)
    expect(isStaff(['athlete', 'admin'])).toBe(true)
  })
})

describe('isRole', () => {
  it('accepts only the six roles', () => {
    for (const r of ROLES) expect(isRole(r)).toBe(true)
    expect(isRole('superuser')).toBe(false)
    expect(isRole(1)).toBe(false)
  })
})
