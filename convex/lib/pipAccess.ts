import type { CommentsVisibility, PostStatus } from './pipRules'

/**
 * Who may look at a PIP post, and who may write under it. Pure, so the
 * same table decides on the server (the gate) and in the browser (what to
 * draw). `pip.ts` works the facts out from the database and hands them
 * here, the way `members.ts` does for `athleteAccess.ts`.
 */
export type PipViewer = {
  userId: string
  /** In the program right now (`selected`, not `removed`). */
  isMember: boolean
  /** Holds `publish_pip`: a lead, or a master admin reading over her shoulder. */
  isLead: boolean
  /** The groups the viewer is in right now — computed, never fanned out. */
  groupIds: readonly string[]
}

/**
 * Reading. A lead sees every post in every state. A member sees a
 * published post that targets everyone (no groups) or one of their
 * groups. Membership is what admits; a removed member's old group rows
 * admit nothing.
 */
export function canReadPost(post: { status: PostStatus; groupIds: readonly string[] }, v: PipViewer): boolean {
  if (v.isLead) return true
  if (!v.isMember || post.status !== 'published') return false
  if (post.groupIds.length === 0) return true
  return post.groupIds.some((g) => v.groupIds.includes(g))
}

/**
 * A comment carries the visibility it was written under. Lead-only ones
 * are read by their author and by leads; hidden ones likewise — the author
 * sees theirs marked, the group sees nothing.
 */
export function canSeeComment(
  c: { authorId: string; visibility: 'lead' | 'group'; hidden: boolean },
  v: PipViewer,
): boolean {
  if (v.isLead || c.authorId === v.userId) return true
  if (c.hidden) return false
  return c.visibility === 'group'
}

/** Writing under a post: members and leads, on a published post whose comments are on. */
export function canCommentOn(
  post: { status: PostStatus; commentsVisibility: CommentsVisibility },
  v: PipViewer,
): boolean {
  if (!(v.isMember || v.isLead)) return false
  return post.status === 'published' && post.commentsVisibility !== 'off'
}

/** Reacting: members and leads, on a published post. */
export function canReact(post: { status: PostStatus }, v: PipViewer): boolean {
  return (v.isMember || v.isLead) && post.status === 'published'
}
