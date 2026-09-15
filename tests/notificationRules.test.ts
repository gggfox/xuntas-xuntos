import { describe, expect, it } from 'vitest'
import { canReceiveNotifications, recipientsFor, targetFor } from '../convex/lib/notificationRules'

const A = 'athlete'
const C1 = 'coach1'
const C2 = 'coach2'
const ADM = 'admin'

describe('recipientsFor · comments', () => {
  it('tells the athlete when staff comment on an entry, and only the athlete', () => {
    expect(recipientsFor({ type: 'comment', actorId: C1, athleteId: A, general: false, threadAuthorIds: [C2] })).toEqual([
      { userId: A, kind: 'entry_comment' },
    ])
  })

  it('tells the staff who already wrote in the thread when the athlete replies', () => {
    expect(
      recipientsFor({ type: 'comment', actorId: A, athleteId: A, general: false, threadAuthorIds: [C1, A, C2, C1] }),
    ).toEqual([
      { userId: C1, kind: 'entry_reply' },
      { userId: C2, kind: 'entry_reply' },
    ])
  })

  it('tells nobody when the athlete writes first in an empty thread', () => {
    expect(recipientsFor({ type: 'comment', actorId: A, athleteId: A, general: true, threadAuthorIds: [] })).toEqual([])
  })

  it('uses the general kinds for the general stream', () => {
    expect(recipientsFor({ type: 'comment', actorId: ADM, athleteId: A, general: true, threadAuthorIds: [] })).toEqual([
      { userId: A, kind: 'general_comment' },
    ])
    expect(recipientsFor({ type: 'comment', actorId: A, athleteId: A, general: true, threadAuthorIds: [ADM] })).toEqual([
      { userId: ADM, kind: 'general_reply' },
    ])
  })
})

describe('recipientsFor · entries and assignments', () => {
  it('tells every assigned staff member about a new entry, once each', () => {
    expect(recipientsFor({ type: 'entry_created', actorId: A, athleteId: A, assignedStaffIds: [C1, C2, C1] })).toEqual([
      { userId: C1, kind: 'entry_created' },
      { userId: C2, kind: 'entry_created' },
    ])
  })

  it('tells both parties about an assignment, never the administrator who made it', () => {
    expect(recipientsFor({ type: 'assignment', ended: false, actorId: ADM, staffId: C1, athleteId: A })).toEqual([
      { userId: C1, kind: 'assignment_created' },
      { userId: A, kind: 'assignment_created' },
    ])
    expect(recipientsFor({ type: 'assignment', ended: true, actorId: ADM, staffId: C1, athleteId: A })).toEqual([
      { userId: C1, kind: 'assignment_ended' },
      { userId: A, kind: 'assignment_ended' },
    ])
  })
})

describe('canReceiveNotifications', () => {
  it('is a member, or anyone who may write in a journal', () => {
    expect(canReceiveNotifications(['athlete'], true)).toBe(true)
    expect(canReceiveNotifications(['athlete'], false)).toBe(false)
    expect(canReceiveNotifications(['coach'], false)).toBe(true)
    expect(canReceiveNotifications(['admin'], false)).toBe(true)
    expect(canReceiveNotifications(['finance'], false)).toBe(false)
  })
})

describe('targetFor', () => {
  it('sends the athlete to their own journal, and staff to the athlete page', () => {
    expect(targetFor({ userId: A, athleteId: A, kind: 'entry_comment', entryId: 'e1' })).toEqual({ to: '/bitacora', search: { entrada: 'e1' } })
    expect(targetFor({ userId: A, athleteId: A, kind: 'general_comment' })).toEqual({ to: '/bitacora', search: undefined })
    expect(targetFor({ userId: A, athleteId: A, kind: 'assignment_created' })).toEqual({ to: '/perfil' })
    expect(targetFor({ userId: C1, athleteId: A, kind: 'entry_created', entryId: 'e1' })).toEqual({
      to: '/administracion/atletas/$id',
      params: { id: A },
      search: { entrada: 'e1' },
    })
  })
})

describe('recipientsFor · the PIP', () => {
  it('tells every member a post reaches when it is published, and not the lead who published it', () => {
    expect(recipientsFor({ type: 'pip_published', actorId: 'L', memberIds: ['m1', 'm2', 'L'] })).toEqual([
      { userId: 'm1', kind: 'pip_post_published' },
      { userId: 'm2', kind: 'pip_post_published' },
    ])
  })

  it('tells the leads when a member comments, and the parent author when someone replies', () => {
    expect(recipientsFor({ type: 'pip_comment', actorId: 'm1', actorIsLead: false, leadIds: ['L', 'L2'] })).toEqual([
      { userId: 'L', kind: 'pip_comment_new' },
      { userId: 'L2', kind: 'pip_comment_new' },
    ])
    expect(recipientsFor({ type: 'pip_comment', actorId: 'L', actorIsLead: true, parentAuthorId: 'm1', leadIds: ['L'] })).toEqual([
      { userId: 'm1', kind: 'pip_comment_reply' },
    ])
  })

  it('tells a replying member\'s lead once, as new, and the parent author as a reply', () => {
    expect(recipientsFor({ type: 'pip_comment', actorId: 'm2', actorIsLead: false, parentAuthorId: 'm1', leadIds: ['L'] })).toEqual([
      { userId: 'm1', kind: 'pip_comment_reply' },
      { userId: 'L', kind: 'pip_comment_new' },
    ])
  })

  it('never tells the actor about their own act', () => {
    expect(recipientsFor({ type: 'pip_comment', actorId: 'm1', actorIsLead: false, parentAuthorId: 'm1', leadIds: [] })).toEqual([])
  })
})

describe('targetFor · the PIP', () => {
  it('sends a member to the feed and a lead to their screen, both at the post', () => {
    expect(targetFor({ userId: 'm1', kind: 'pip_post_published', postId: 'p1', forLead: false })).toEqual({ to: '/pip', search: { publicacion: 'p1' } })
    expect(targetFor({ userId: 'L', kind: 'pip_comment_new', postId: 'p1', forLead: true })).toEqual({ to: '/administracion/pip', search: { publicacion: 'p1' } })
  })
})

describe('canReceiveNotifications · the lead', () => {
  it('gives a lead a bell', () => {
    expect(canReceiveNotifications(['pip_lead'], false)).toBe(true)
  })
})
