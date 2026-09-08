import { describe, expect, it } from 'vitest'
import { canCommentOn, canReadAthlete, canWriteEntries } from '../convex/lib/athleteAccess'
import { permissionsOf } from '../convex/lib/permissions'

const admin = permissionsOf(['admin'])
const master = permissionsOf(['master_admin'])
const coach = permissionsOf(['coach'])
const health = permissionsOf(['health'])
const finance = permissionsOf(['finance'])
const athlete = permissionsOf(['athlete'])

const other = { isSelf: false, isAssigned: false, isMember: true }
const assigned = { isSelf: false, isAssigned: true, isMember: true }
const self = { isSelf: true, isAssigned: false, isMember: true }

describe('canReadAthlete', () => {
  it('lets administration see every member, assigned or not', () => {
    expect(canReadAthlete({ permissions: admin, ...other })).toBe(true)
    expect(canReadAthlete({ permissions: master, ...other })).toBe(true)
  })

  it('lets a coach or a health specialist see only who is assigned to them', () => {
    for (const p of [coach, health]) {
      expect(canReadAthlete({ permissions: p, ...assigned })).toBe(true)
      expect(canReadAthlete({ permissions: p, ...other })).toBe(false)
    }
  })

  it('shows finance nothing', () => {
    expect(canReadAthlete({ permissions: finance, ...assigned })).toBe(false)
  })

  it('lets the athlete see their own journal while a member', () => {
    expect(canReadAthlete({ permissions: athlete, ...self })).toBe(true)
    expect(canReadAthlete({ permissions: athlete, ...self, isMember: false })).toBe(false)
    expect(canReadAthlete({ permissions: athlete, ...other })).toBe(false)
  })

  /** Removal ends the assignments, but even a stale one must not open a frozen journal to a coach. */
  it('keeps a removed member readable by administration alone', () => {
    expect(canReadAthlete({ permissions: admin, ...other, isMember: false })).toBe(true)
    expect(canReadAthlete({ permissions: coach, ...assigned, isMember: false })).toBe(true)
  })
})

describe('canWriteEntries', () => {
  it('is the athlete alone, while a member', () => {
    expect(canWriteEntries(self)).toBe(true)
    expect(canWriteEntries({ ...self, isMember: false })).toBe(false)
    expect(canWriteEntries(assigned)).toBe(false)
  })
})

describe('canCommentOn', () => {
  it('lets administration and assigned staff comment, and the athlete reply', () => {
    expect(canCommentOn({ permissions: admin, ...other })).toBe(true)
    expect(canCommentOn({ permissions: master, ...other })).toBe(true)
    expect(canCommentOn({ permissions: coach, ...assigned })).toBe(true)
    expect(canCommentOn({ permissions: health, ...assigned })).toBe(true)
    expect(canCommentOn({ permissions: athlete, ...self })).toBe(true)
  })

  it('refuses an unassigned coach and finance', () => {
    expect(canCommentOn({ permissions: coach, ...other })).toBe(false)
    expect(canCommentOn({ permissions: finance, ...assigned })).toBe(false)
  })

  it('takes no more words once the member is removed, from anyone', () => {
    expect(canCommentOn({ permissions: admin, ...other, isMember: false })).toBe(false)
    expect(canCommentOn({ permissions: athlete, ...self, isMember: false })).toBe(false)
  })
})
