import { describe, expect, it } from 'vitest'
import { canCommentOn, canReact, canReadPost, canSeeComment } from '../convex/lib/pipAccess'

const member = { userId: 'm1', isMember: true, isLead: false, groupIds: ['g1'] }
const outsider = { userId: 'x1', isMember: false, isLead: false, groupIds: [] }
const lead = { userId: 'L', isMember: false, isLead: true, groupIds: [] }
const removed = { userId: 'r1', isMember: false, isLead: false, groupIds: ['g1'] }

describe('canReadPost', () => {
  it('shows a published post to every member when it targets nobody in particular', () => {
    expect(canReadPost({ status: 'published', groupIds: [] }, member)).toBe(true)
  })

  it('shows a targeted post only to members of one of its groups', () => {
    expect(canReadPost({ status: 'published', groupIds: ['g1', 'g9'] }, member)).toBe(true)
    expect(canReadPost({ status: 'published', groupIds: ['g2'] }, member)).toBe(false)
  })

  it('shows nothing that is not published to a member', () => {
    for (const status of ['draft', 'scheduled', 'unpublished'] as const) {
      expect(canReadPost({ status, groupIds: [] }, member)).toBe(false)
    }
  })

  it('shows every post in every state to a lead', () => {
    for (const status of ['draft', 'scheduled', 'published', 'unpublished'] as const) {
      expect(canReadPost({ status, groupIds: ['g2'] }, lead)).toBe(true)
    }
  })

  it('shows nothing to an outsider or a removed member, whatever their old groups say', () => {
    expect(canReadPost({ status: 'published', groupIds: [] }, outsider)).toBe(false)
    expect(canReadPost({ status: 'published', groupIds: ['g1'] }, removed)).toBe(false)
  })
})

describe('canSeeComment', () => {
  it('shows a group-visible comment to everyone who reads the post', () => {
    expect(canSeeComment({ authorId: 'm2', visibility: 'group', hidden: false }, member)).toBe(true)
  })

  it('shows a lead-only comment to its author and to leads', () => {
    const c = { authorId: 'm1', visibility: 'lead' as const, hidden: false }
    expect(canSeeComment(c, member)).toBe(true)
    expect(canSeeComment(c, { ...member, userId: 'm2' })).toBe(false)
    expect(canSeeComment(c, lead)).toBe(true)
  })

  it('shows a hidden comment to its author (marked) and to leads, and to nobody else', () => {
    const c = { authorId: 'm1', visibility: 'group' as const, hidden: true }
    expect(canSeeComment(c, member)).toBe(true)
    expect(canSeeComment(c, { ...member, userId: 'm2' })).toBe(false)
    expect(canSeeComment(c, lead)).toBe(true)
  })
})

describe('canCommentOn and canReact', () => {
  it('lets members and leads comment on a published post whose comments are on', () => {
    expect(canCommentOn({ status: 'published', commentsVisibility: 'lead' }, member)).toBe(true)
    expect(canCommentOn({ status: 'published', commentsVisibility: 'group' }, lead)).toBe(true)
    expect(canCommentOn({ status: 'published', commentsVisibility: 'off' }, member)).toBe(false)
    expect(canCommentOn({ status: 'unpublished', commentsVisibility: 'group' }, member)).toBe(false)
    expect(canCommentOn({ status: 'published', commentsVisibility: 'group' }, outsider)).toBe(false)
  })

  it('lets members and leads react to a published post', () => {
    expect(canReact({ status: 'published' }, member)).toBe(true)
    expect(canReact({ status: 'published' }, lead)).toBe(true)
    expect(canReact({ status: 'draft' }, lead)).toBe(false)
    expect(canReact({ status: 'published' }, outsider)).toBe(false)
  })
})
