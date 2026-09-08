import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  ROLES,
  can,
  isAthlete,
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

  /** "Complete access to everything": a missing checkbox must never lock a master_admin out. */
  it('makes master_admin a superset of every permission', () => {
    for (const p of PERMISSIONS) expect(can(['master_admin'], p)).toBe(true)
  })

  it('grants nothing to athletes and to the roles without screens yet', () => {
    for (const role of ['athlete', 'coach', 'finance', 'health'] as const) {
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

/**
 * Not the opposite of `isStaff`: `staff.ts` keeps `athlete` when it grants a
 * staff role, so an account can be both, and one that is only staff has no
 * registration to reach.
 */
describe('isAthlete', () => {
  it('is anyone whose roles include athlete', () => {
    expect(isAthlete(['athlete'])).toBe(true)
    expect(isAthlete(['athlete', 'admin'])).toBe(true)
    expect(isAthlete(['admin'])).toBe(false)
    expect(isAthlete(['master_admin', 'coach'])).toBe(false)
    expect(isAthlete([])).toBe(false)
  })
})

describe('isRole', () => {
  it('accepts only the six roles', () => {
    for (const r of ROLES) expect(isRole(r)).toBe(true)
    expect(isRole('superuser')).toBe(false)
    expect(isRole(1)).toBe(false)
  })
})
