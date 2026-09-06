import { describe, expect, it } from 'vitest'
import {
  INVITE_TTL_MS,
  checkRoleChange,
  inviteStatus,
  normalizeStaffRoles,
  validateInvite,
} from '../convex/lib/staffRules'

const NOW = Date.parse('2026-09-03T18:00:00.000Z')

describe('normalizeStaffRoles', () => {
  it('drops athlete, unknowns and duplicates, and keeps table order', () => {
    expect(normalizeStaffRoles(['coach', 'athlete', 'admin', 'coach', 'god'])).toEqual([
      'admin',
      'coach',
    ])
  })
})

describe('validateInvite', () => {
  it('accepts an email and at least one staff role', () => {
    expect(validateInvite({ email: 'ana@xuntas.org', roles: ['admin'] })).toBeNull()
  })

  it('rejects a bad email', () => {
    expect(validateInvite({ email: 'ana', roles: ['admin'] })).toBe('invite_email_invalid')
  })

  /** An invite for "athlete" is a sign-up link, not an invitation. */
  it('rejects roles that leave nothing staff-like', () => {
    expect(validateInvite({ email: 'ana@xuntas.org', roles: [] })).toBe('invite_roles_invalid')
    expect(validateInvite({ email: 'ana@xuntas.org', roles: ['athlete'] })).toBe(
      'invite_roles_invalid',
    )
  })
})

describe('inviteStatus', () => {
  const base = { expiresAt: NOW + INVITE_TTL_MS }

  it('is pending until it expires', () => {
    expect(inviteStatus(base, NOW)).toBe('pending')
    expect(inviteStatus(base, NOW + INVITE_TTL_MS + 1)).toBe('expired')
  })

  it('reports accepted and revoked ahead of expiry', () => {
    expect(inviteStatus({ ...base, acceptedAt: NOW }, NOW + INVITE_TTL_MS + 1)).toBe('accepted')
    expect(inviteStatus({ ...base, revokedAt: NOW }, NOW)).toBe('revoked')
  })
})

describe('checkRoleChange', () => {
  const me = { actorId: 'u1', actorRoles: ['master_admin'] as const }

  it('lets a master_admin change someone else freely', () => {
    expect(
      checkRoleChange({
        ...me,
        targetId: 'u2',
        targetRoles: ['admin'],
        nextRoles: ['admin', 'coach'],
        masterAdminCount: 1,
      }),
    ).toBeNull()
  })

  it('refuses to remove your own master_admin', () => {
    expect(
      checkRoleChange({
        ...me,
        targetId: 'u1',
        targetRoles: ['master_admin'],
        nextRoles: ['admin'],
        masterAdminCount: 3,
      }),
    ).toBe('cannot_remove_own_master_admin')
  })

  it('refuses to remove the last master_admin, whoever they are', () => {
    expect(
      checkRoleChange({
        ...me,
        targetId: 'u2',
        targetRoles: ['master_admin'],
        nextRoles: [],
        masterAdminCount: 1,
      }),
    ).toBe('cannot_remove_last_master_admin')
  })

  it('allows removing a master_admin when another remains', () => {
    expect(
      checkRoleChange({
        ...me,
        targetId: 'u2',
        targetRoles: ['master_admin'],
        nextRoles: ['admin'],
        masterAdminCount: 2,
      }),
    ).toBeNull()
  })
})
