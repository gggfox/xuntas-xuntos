import { describe, expect, it } from 'vitest'
import { canBeAssigned, diffAssignments } from '../convex/lib/assignmentRules'

describe('canBeAssigned', () => {
  it('is the coach and the health specialist, not administration', () => {
    expect(canBeAssigned(['coach'])).toBe(true)
    expect(canBeAssigned(['health'])).toBe(true)
    expect(canBeAssigned(['athlete', 'coach'])).toBe(true)
    expect(canBeAssigned(['admin'])).toBe(false)
    expect(canBeAssigned(['finance'])).toBe(false)
    expect(canBeAssigned(['athlete'])).toBe(false)
  })

  /** Anyone who sees everyone already has no list to fill — a coach who is also an admin included. */
  it('is nobody who already sees every member', () => {
    expect(canBeAssigned(['master_admin'])).toBe(false)
    expect(canBeAssigned(['coach', 'admin'])).toBe(false)
  })
})

describe('diffAssignments', () => {
  it('adds what is new and ends what was dropped', () => {
    expect(diffAssignments(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], end: ['a'] })
  })

  it('is a no-op for the same list in another order', () => {
    expect(diffAssignments(['a', 'b'], ['b', 'a'])).toEqual({ add: [], end: [] })
  })

  it('counts a repeated id once', () => {
    expect(diffAssignments([], ['a', 'a'])).toEqual({ add: ['a'], end: [] })
  })

  it('ends everything for an empty list', () => {
    expect(diffAssignments(['a', 'b'], [])).toEqual({ add: [], end: ['a', 'b'] })
  })
})
