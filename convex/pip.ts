import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { fail, requirePermission, requireUser } from './auth'
import { membershipOf } from './members'
import { can } from './lib/permissions'
import { canCommentOn, canReact, canReadPost, canSeeComment, type PipViewer } from './lib/pipAccess'
import {
  canDeletePost,
  checkTransition,
  isEmoji,
  monthKeyOf,
  monthRange,
  validateGroupName,
  validatePipComment,
  validatePost,
  type PostKind,
} from './lib/pipRules'
import { notify } from './notifications'
import { vAttachment, vCommentsVisibility, vPostKind } from './schema'

/**
 * The PIP: posts a lead publishes to groups of members, on a schedule, with
 * comments and reactions. Every read resolves a `PipViewer` and asks
 * `pipAccess`; every write asks `pipRules`. Nothing here decides — it
 * fetches, asks, and writes.
 */

// ---------------------------------------------------------------------------
// The viewer

export async function activeGroupIdsOf(ctx: QueryCtx, userId: Id<'users'>): Promise<Id<'pipGroups'>[]> {
  const rows = await ctx.db
    .query('pipGroupMembers')
    .withIndex('by_athlete_active', (q) => q.eq('athleteUserId', userId).eq('removedAt', undefined))
    .collect()
  return rows.map((r) => r.groupId)
}

async function viewerOf(ctx: QueryCtx, user: Doc<'users'>): Promise<PipViewer> {
  const isLead = can(user.roles, 'publish_pip')
  const isMember = (await membershipOf(ctx, user._id)) !== null
  return { userId: user._id, isMember, isLead, groupIds: isMember ? await activeGroupIdsOf(ctx, user._id) : [] }
}

/** Members and leads. Anyone else reads `not_a_member`, which is what the page says too. */
async function requireViewer(ctx: QueryCtx): Promise<{ actor: Doc<'users'>; viewer: PipViewer }> {
  const actor = await requireUser(ctx)
  const viewer = await viewerOf(ctx, actor)
  if (!viewer.isMember && !viewer.isLead) fail('not_a_member')
  return { actor, viewer }
}

async function requirePost(ctx: QueryCtx, id: Id<'pipPosts'>): Promise<Doc<'pipPosts'>> {
  const post = await ctx.db.get(id)
  if (!post) fail('post_not_found')
  return post
}

/** Adapter from a comment row to what `canSeeComment` reads. Written once, used everywhere a comment's visibility is checked. */
function seeable(c: Doc<'pipComments'>, viewer: PipViewer): boolean {
  return canSeeComment({ authorId: c.authorId, visibility: c.visibility, hidden: c.hiddenAt !== undefined }, viewer)
}

// ---------------------------------------------------------------------------
// Groups (the data; the screen comes in the next plan)

async function requireGroup(ctx: QueryCtx, id: Id<'pipGroups'>): Promise<Doc<'pipGroups'>> {
  const g = await ctx.db.get(id)
  if (!g) fail('group_not_found')
  return g
}

export const createGroup = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_pip_groups')
    const problem = validateGroupName(args.name)
    if (problem) fail(problem)
    const id = await ctx.db.insert('pipGroups', { name: args.name.trim(), createdBy: actor._id, createdAt: Date.now() })
    return { id }
  },
})

export const renameGroup = mutation({
  args: { id: v.id('pipGroups'), name: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'manage_pip_groups')
    const g = await requireGroup(ctx, args.id)
    if (g.archivedAt !== undefined) fail('group_archived')
    const problem = validateGroupName(args.name)
    if (problem) fail(problem)
    await ctx.db.patch(g._id, { name: args.name.trim() })
    return { ok: true as const }
  },
})

/** Archive, never delete: an old post still says who it went to. */
export const archiveGroup = mutation({
  args: { id: v.id('pipGroups') },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'manage_pip_groups')
    const g = await requireGroup(ctx, args.id)
    if (g.archivedAt === undefined) await ctx.db.patch(g._id, { archivedAt: Date.now() })
    return { ok: true as const }
  },
})

/**
 * The whole membership of one group at once: rows for the newcomers, an
 * end for the ones no longer listed, nothing for the ones that stay.
 */
export const setGroupMembers = mutation({
  args: { id: v.id('pipGroups'), athleteUserIds: v.array(v.id('users')) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_pip_groups')
    const g = await requireGroup(ctx, args.id)
    if (g.archivedAt !== undefined) fail('group_archived')
    const wanted = new Set(args.athleteUserIds)
    const active = await ctx.db
      .query('pipGroupMembers')
      .withIndex('by_group_active', (q) => q.eq('groupId', g._id).eq('removedAt', undefined))
      .collect()
    const now = Date.now()
    for (const row of active) {
      if (!wanted.has(row.athleteUserId)) await ctx.db.patch(row._id, { removedAt: now })
      wanted.delete(row.athleteUserId)
    }
    for (const athleteUserId of wanted) {
      // Only members join a group; a non-member id is dropped, not refused.
      if (!(await membershipOf(ctx, athleteUserId))) continue
      await ctx.db.insert('pipGroupMembers', { groupId: g._id, athleteUserId, addedBy: actor._id, addedAt: now })
    }
    return { ok: true as const }
  },
})

/** Called by `decide` on removal: a removed member leaves every group in the same mutation. */
export async function endPipGroupsForAthlete(ctx: MutationCtx, athleteUserId: Id<'users'>, now: number): Promise<void> {
  const rows = await ctx.db
    .query('pipGroupMembers')
    .withIndex('by_athlete_active', (q) => q.eq('athleteUserId', athleteUserId).eq('removedAt', undefined))
    .collect()
  for (const r of rows) await ctx.db.patch(r._id, { removedAt: now })
}

/** Everyone a post reaches: every member when it targets nobody, else the union of its groups' active members. */
async function memberIdsReached(ctx: QueryCtx, groupIds: readonly Id<'pipGroups'>[]): Promise<Id<'users'>[]> {
  const out = new Set<Id<'users'>>()
  if (groupIds.length === 0) {
    const rows = await ctx.db
      .query('registrations')
      .withIndex('by_status_user', (q) => q.eq('status', 'selected'))
      .collect()
    for (const r of rows) out.add(r.userId)
    return [...out]
  }
  for (const groupId of groupIds) {
    const rows = await ctx.db
      .query('pipGroupMembers')
      .withIndex('by_group_active', (q) => q.eq('groupId', groupId).eq('removedAt', undefined))
      .collect()
    for (const r of rows) out.add(r.athleteUserId)
  }
  return [...out]
}

// ---------------------------------------------------------------------------
// Posts: the writes

const postArgs = {
  kind: vPostKind,
  title: v.string(),
  body: v.string(),
  attachments: v.array(vAttachment),
  groupIds: v.array(v.id('pipGroups')),
  commentsVisibility: vCommentsVisibility,
}

async function checkPostInput(ctx: QueryCtx, args: { kind: PostKind; title: string; body: string; attachments: unknown[]; groupIds: Id<'pipGroups'>[]; commentsVisibility: 'off' | 'lead' | 'group' }) {
  const problem = validatePost({ ...args, attachmentCount: args.attachments.length })
  if (problem) fail(problem)
  for (const id of args.groupIds) {
    const g = await requireGroup(ctx, id)
    if (g.archivedAt !== undefined) fail('group_archived')
  }
}

/** A new post is a draft. Nothing releases until the lead says so. */
export const createPost = mutation({
  args: postArgs,
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'publish_pip')
    await checkPostInput(ctx, args)
    const now = Date.now()
    const id = await ctx.db.insert('pipPosts', {
      authorId: actor._id,
      kind: args.kind,
      title: args.title.trim(),
      body: args.body.trim(),
      attachments: args.attachments,
      groupIds: [...new Set(args.groupIds)],
      commentsVisibility: args.commentsVisibility,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      commentCount: 0,
      reactionCount: 0,
    })
    return { id }
  },
})

/** Edits keep the state. After release they stamp `editedAt`, which the feed shows as "editado". */
export const updatePost = mutation({
  args: { id: v.id('pipPosts'), ...postArgs },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'publish_pip')
    const post = await requirePost(ctx, args.id)
    await checkPostInput(ctx, args)
    const now = Date.now()
    await ctx.db.patch(post._id, {
      kind: args.kind,
      title: args.title.trim(),
      body: args.body.trim(),
      attachments: args.attachments,
      groupIds: [...new Set(args.groupIds)],
      commentsVisibility: args.commentsVisibility,
      updatedAt: now,
      editedAt: post.status === 'published' || post.status === 'unpublished' ? now : post.editedAt,
    })
    return { ok: true as const }
  },
})

async function cancelRelease(ctx: MutationCtx, post: Doc<'pipPosts'>) {
  if (post.scheduledJobId) await ctx.scheduler.cancel(post.scheduledJobId)
}

/**
 * Schedule (a future moment) or move back to draft (`scheduledFor` absent).
 * Rescheduling cancels the old job and books a new one.
 */
export const setSchedule = mutation({
  args: { id: v.id('pipPosts'), scheduledFor: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'publish_pip')
    const post = await requirePost(ctx, args.id)
    const now = Date.now()
    if (args.scheduledFor === undefined) {
      const problem = checkTransition(post.status, 'draft', { now })
      if (problem) fail(problem)
      await cancelRelease(ctx, post)
      await ctx.db.patch(post._id, { status: 'draft', scheduledFor: undefined, scheduledJobId: undefined, updatedAt: now })
      return { ok: true as const }
    }
    // From draft, or a re-timing of one already scheduled.
    const from = post.status === 'scheduled' ? 'draft' : post.status
    const problem = checkTransition(from, 'scheduled', { scheduledFor: args.scheduledFor, now })
    if (problem) fail(problem)
    await cancelRelease(ctx, post)
    const jobId = await ctx.scheduler.runAt(args.scheduledFor, internal.pip.release, { id: post._id })
    await ctx.db.patch(post._id, { status: 'scheduled', scheduledFor: args.scheduledFor, scheduledJobId: jobId, updatedAt: now })
    return { ok: true as const }
  },
})

/** The one place a post becomes published: the job, or "publish now". Tells everyone it reaches. */
async function publish(ctx: MutationCtx, post: Doc<'pipPosts'>, actorId: Id<'users'>) {
  const now = Date.now()
  await ctx.db.patch(post._id, {
    status: 'published',
    publishedAt: now,
    scheduledFor: undefined,
    scheduledJobId: undefined,
    unpublishedAt: undefined,
    updatedAt: now,
  })
  const memberIds = await memberIdsReached(ctx, post.groupIds)
  await notify(ctx, { type: 'pip_published', actorId, memberIds }, { postId: post._id })
}

export const publishNow = mutation({
  args: { id: v.id('pipPosts') },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'publish_pip')
    const post = await requirePost(ctx, args.id)
    const problem = checkTransition(post.status, 'published', { now: Date.now() })
    if (problem) fail(problem)
    await cancelRelease(ctx, post)
    await publish(ctx, post, actor._id)
    return { ok: true as const }
  },
})

/** The scheduled job. Re-reads the row: a post moved back to draft since is left alone. */
export const release = internalMutation({
  args: { id: v.id('pipPosts') },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id)
    if (!post || post.status !== 'scheduled') return { released: false }
    await publish(ctx, post, post.authorId)
    return { released: true }
  },
})

/** Hidden from members, kept whole for leads. Reversible. */
export const unpublish = mutation({
  args: { id: v.id('pipPosts') },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'publish_pip')
    const post = await requirePost(ctx, args.id)
    const now = Date.now()
    const problem = checkTransition(post.status, 'unpublished', { now })
    if (problem) fail(problem)
    await ctx.db.patch(post._id, { status: 'unpublished', unpublishedAt: now, updatedAt: now })
    return { ok: true as const }
  },
})

/** Back out, keeping the original `publishedAt` so it does not jump to the top. Tells nobody twice. */
export const republish = mutation({
  args: { id: v.id('pipPosts') },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'publish_pip')
    const post = await requirePost(ctx, args.id)
    const now = Date.now()
    const problem = checkTransition(post.status, 'published', { now })
    if (problem) fail(problem)
    await ctx.db.patch(post._id, { status: 'published', unpublishedAt: undefined, updatedAt: now })
    return { ok: true as const }
  },
})

/** Only while nothing has been said or felt. Otherwise `unpublish`. */
export const deletePost = mutation({
  args: { id: v.id('pipPosts') },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'publish_pip')
    const post = await requirePost(ctx, args.id)
    const problem = canDeletePost(post)
    if (problem) fail(problem)
    await cancelRelease(ctx, post)
    await ctx.db.delete(post._id)
    return { ok: true as const }
  },
})

// ---------------------------------------------------------------------------
// Posts: the reads

async function reactionsOf(
  ctx: QueryCtx,
  targetKind: 'post' | 'comment',
  targetId: Id<'pipPosts'> | Id<'pipComments'>,
  userId: Id<'users'>,
): Promise<{ emoji: string; count: number; mine: boolean }[]> {
  const rows = await ctx.db
    .query('pipReactions')
    .withIndex('by_target', (q) => q.eq('targetKind', targetKind).eq('targetId', targetId))
    .collect()
  const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean }>()
  for (const r of rows) {
    const e = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false }
    e.count += 1
    if (r.userId === userId) e.mine = true
    byEmoji.set(r.emoji, e)
  }
  // Most used first; ties by first appearance, which is insertion order.
  return [...byEmoji.values()].sort((a, b) => b.count - a.count)
}

/**
 * A post's comments, as the viewer may see them: the top-level comments
 * that pass `seeable`, each paired with the replies under it that also
 * pass `seeable`. A reply whose parent the viewer cannot see is dropped
 * with it — it would be unreachable in the thread either way.
 * `visibleCommentCount` and `comments` both walk this same tree, on
 * purpose, so a hidden comment's replies are never counted without also
 * being drawn, or drawn without being counted.
 */
async function visibleThreadOf(
  ctx: QueryCtx,
  postId: Id<'pipPosts'>,
  viewer: PipViewer,
): Promise<{ top: Doc<'pipComments'>[]; repliesOf: Map<Id<'pipComments'>, Doc<'pipComments'>[]> }> {
  const all = await ctx.db
    .query('pipComments')
    .withIndex('by_post_parent', (q) => q.eq('postId', postId))
    .collect()
  const top = all.filter((c) => c.parentId === undefined && seeable(c, viewer))
  const repliesOf = new Map<Id<'pipComments'>, Doc<'pipComments'>[]>()
  for (const c of all) {
    if (c.parentId && seeable(c, viewer)) repliesOf.set(c.parentId, [...(repliesOf.get(c.parentId) ?? []), c])
  }
  return { top, repliesOf }
}

/** How many comments this viewer would see under the post — visible replies of visible parents included. */
async function visibleCommentCount(ctx: QueryCtx, postId: Id<'pipPosts'>, viewer: PipViewer): Promise<number> {
  const { top, repliesOf } = await visibleThreadOf(ctx, postId, viewer)
  return top.reduce((n, c) => n + 1 + (repliesOf.get(c._id)?.length ?? 0), 0)
}

async function postView(ctx: QueryCtx, post: Doc<'pipPosts'>, viewer: PipViewer) {
  const author = await ctx.db.get(post.authorId)
  const attachments = await Promise.all(
    post.attachments.map(async (a) => {
      if (a.type === 'youtube') return { type: 'youtube' as const, videoId: a.videoId, unavailable: a.unavailable === true }
      return { type: a.type, url: await ctx.storage.getUrl(a.storageId), name: a.name }
    }),
  )
  return {
    _id: post._id,
    kind: post.kind,
    title: post.title,
    body: post.body,
    authorName: author?.name ?? author?.email ?? '',
    publishedAt: post.publishedAt ?? post.createdAt,
    editedAt: post.editedAt,
    commentsVisibility: post.commentsVisibility,
    attachments,
    reactions: await reactionsOf(ctx, 'post', post._id, viewer.userId as Id<'users'>),
    commentCount: post.commentsVisibility === 'off' ? 0 : await visibleCommentCount(ctx, post._id, viewer),
  }
}

/**
 * The member's feed: published posts the viewer may read, newest first,
 * within one month if asked, of one kind if asked. Visibility is filtered
 * after the page is read, so a page can come back short of the asked
 * size; `isDone` still says when the end is reached.
 */
export const feed = query({
  args: { month: v.optional(v.string()), kind: v.optional(vPostKind), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx)
    const range = args.month ? monthRange(args.month) : null
    const page = await ctx.db
      .query('pipPosts')
      .withIndex('by_status_published', (q) => {
        const published = q.eq('status', 'published')
        return range ? published.gte('publishedAt', range.from).lt('publishedAt', range.to) : published
      })
      .order('desc')
      .paginate(args.paginationOpts)
    const readable = page.page.filter((p) => canReadPost(p, viewer) && (!args.kind || p.kind === args.kind))
    return { ...page, page: await Promise.all(readable.map((p) => postView(ctx, p, viewer))) }
  },
})

/** The months the select offers, with counts, for what the viewer may read. */
export const months = query({
  args: {},
  handler: async (ctx) => {
    const { viewer } = await requireViewer(ctx)
    const rows = await ctx.db
      .query('pipPosts')
      .withIndex('by_status_published', (q) => q.eq('status', 'published'))
      .order('desc')
      .take(1000)
    const counts = new Map<string, number>()
    for (const p of rows) {
      if (!canReadPost(p, viewer)) continue
      const key = monthKeyOf(p.publishedAt ?? p.createdAt)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts].map(([key, count]) => ({ key, count }))
  },
})

/** One post, for a notification that points at it. `null` when gone or unreadable. */
export const post = query({
  args: { id: v.id('pipPosts') },
  handler: async (ctx, args) => {
    const { viewer } = await requireViewer(ctx)
    const p = await ctx.db.get(args.id)
    if (!p || !canReadPost(p, viewer)) return null
    return await postView(ctx, p, viewer)
  },
})

// ---------------------------------------------------------------------------
// Comments

async function requireComment(ctx: QueryCtx, id: Id<'pipComments'>): Promise<Doc<'pipComments'>> {
  const c = await ctx.db.get(id)
  if (!c) fail('pip_comment_not_found')
  return c
}

/** The post a member may read, or `post_not_found` — never a hint that a guessed id exists. */
async function requireReadablePost(ctx: QueryCtx, id: Id<'pipPosts'>) {
  const { actor, viewer } = await requireViewer(ctx)
  const post = await ctx.db.get(id)
  if (!post || !canReadPost(post, viewer)) fail('post_not_found')
  return { actor, viewer, post }
}

/** The recursion in `commentView` (one level deep in practice, since replies are fetched with an empty `replies` array) needs an explicit return type — TS cannot infer the return type of an async function that calls itself. */
type CommentView = {
  _id: Id<'pipComments'>
  authorName: string
  isLead: boolean
  isMine: boolean
  inactive: boolean
  body: string
  createdAt: number
  visibility: 'lead' | 'group'
  hidden: boolean
  reactions: { emoji: string; count: number; mine: boolean }[]
  replies: CommentView[]
}

async function commentView(ctx: QueryCtx, c: Doc<'pipComments'>, viewer: PipViewer, replies: Doc<'pipComments'>[]): Promise<CommentView> {
  const author = await ctx.db.get(c.authorId)
  const authorIsLead = author ? can(author.roles, 'publish_pip') : false
  const inactive = !authorIsLead && (await membershipOf(ctx, c.authorId)) === null
  const visibleReplies = replies.filter((r) => seeable(r, viewer))
  return {
    _id: c._id,
    authorName: author?.name ?? author?.email ?? '',
    isLead: authorIsLead,
    isMine: c.authorId === viewer.userId,
    inactive,
    body: c.body,
    createdAt: c.createdAt,
    visibility: c.visibility,
    hidden: c.hiddenAt !== undefined,
    reactions: c.parentId ? [] : await reactionsOf(ctx, 'comment', c._id, viewer.userId as Id<'users'>),
    replies: await Promise.all(visibleReplies.map((r) => commentView(ctx, r, viewer, []))),
  }
}

/** A post's thread, oldest first, each comment with its replies. Filtered by `canSeeComment`, so a lead-only thread shows a member only their own. */
export const comments = query({
  args: { postId: v.id('pipPosts') },
  handler: async (ctx, args) => {
    const { viewer, post } = await requireReadablePost(ctx, args.postId)
    if (post.commentsVisibility === 'off') return { canComment: false, comments: [] }
    const { top, repliesOf } = await visibleThreadOf(ctx, post._id, viewer)
    return {
      canComment: canCommentOn(post, viewer),
      comments: await Promise.all(top.map((c) => commentView(ctx, c, viewer, repliesOf.get(c._id) ?? []))),
    }
  },
})

export const addComment = mutation({
  args: { postId: v.id('pipPosts'), body: v.string(), parentId: v.optional(v.id('pipComments')) },
  handler: async (ctx, args) => {
    const { actor, viewer, post } = await requireReadablePost(ctx, args.postId)
    if (post.commentsVisibility === 'off') fail('comments_off')
    if (!canCommentOn(post, viewer)) fail('permission_required')
    const problem = validatePipComment(args.body)
    if (problem) fail(problem)

    let parent: Doc<'pipComments'> | null = null
    if (args.parentId) {
      parent = await requireComment(ctx, args.parentId)
      // Replies hang off top-level comments of this post only, and off ones the replier can see.
      if (parent.postId !== post._id || parent.parentId !== undefined) fail('pip_comment_not_found')
      if (!seeable(parent, viewer)) fail('pip_comment_not_found')
    }

    const id = await ctx.db.insert('pipComments', {
      postId: post._id,
      parentId: parent?._id,
      authorId: actor._id,
      body: args.body.trim(),
      // Written under the post's rule at this moment; a later flip does not follow it.
      visibility: post.commentsVisibility === 'group' ? 'group' : 'lead',
      createdAt: Date.now(),
      replyCount: 0,
    })
    await ctx.db.patch(post._id, { commentCount: post.commentCount + 1 })
    if (parent) await ctx.db.patch(parent._id, { replyCount: parent.replyCount + 1 })

    const leadIds = (await ctx.db.query('users').collect()).filter((u) => can(u.roles, 'publish_pip')).map((u) => u._id)
    await notify(
      ctx,
      {
        type: 'pip_comment',
        actorId: actor._id,
        actorIsLead: viewer.isLead,
        parentAuthorId: parent?.authorId,
        leadIds,
      },
      { postId: post._id },
    )
    return { id }
  },
})

/** Authors delete their own, while it has neither replies nor reactions; the thread never loses its root. */
export const deleteComment = mutation({
  args: { id: v.id('pipComments') },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx)
    const c = await requireComment(ctx, args.id)
    if (c.authorId !== actor._id) fail('not_comment_author')
    const reactions = await ctx.db
      .query('pipReactions')
      .withIndex('by_target', (q) => q.eq('targetKind', 'comment').eq('targetId', c._id))
      .first()
    if (c.replyCount > 0 || reactions) fail('post_has_activity')
    await ctx.db.delete(c._id)
    const post = await ctx.db.get(c.postId)
    if (post) await ctx.db.patch(post._id, { commentCount: Math.max(0, post.commentCount - 1) })
    if (c.parentId) {
      const parent = await ctx.db.get(c.parentId)
      if (parent) await ctx.db.patch(parent._id, { replyCount: Math.max(0, parent.replyCount - 1) })
    }
    return { ok: true as const }
  },
})

/** Gone from the group, marked for its author, kept for leads. Reversible. */
export const hideComment = mutation({
  args: { id: v.id('pipComments'), hidden: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'publish_pip')
    const c = await requireComment(ctx, args.id)
    await ctx.db.patch(c._id, args.hidden ? { hiddenAt: Date.now(), hiddenBy: actor._id } : { hiddenAt: undefined, hiddenBy: undefined })
    return { ok: true as const }
  },
})

// ---------------------------------------------------------------------------
// Reactions

const vTargetKind = v.union(v.literal('post'), v.literal('comment'))
const vTargetId = v.union(v.id('pipPosts'), v.id('pipComments'))

/** The post a reaction target belongs to, readable by the viewer, or `post_not_found`. Comments must be top-level. */
async function requireReactable(ctx: QueryCtx, targetKind: 'post' | 'comment', targetId: Id<'pipPosts'> | Id<'pipComments'>) {
  const { actor, viewer } = await requireViewer(ctx)
  const postId = targetKind === 'post' ? (targetId as Id<'pipPosts'>) : (await requireComment(ctx, targetId as Id<'pipComments'>)).postId
  const post = await ctx.db.get(postId)
  if (!post || !canReadPost(post, viewer)) fail('post_not_found')
  if (targetKind === 'comment') {
    const c = await requireComment(ctx, targetId as Id<'pipComments'>)
    if (c.parentId !== undefined) fail('pip_comment_not_found')
    if (!seeable(c, viewer)) fail('pip_comment_not_found')
  }
  if (!canReact(post, viewer)) fail('permission_required')
  return { actor, post }
}

/** Toggle: on if the viewer has not reacted with this emoji here, off if they have. */
export const react = mutation({
  args: { targetKind: vTargetKind, targetId: vTargetId, emoji: v.string() },
  handler: async (ctx, args) => {
    if (!isEmoji(args.emoji)) fail('emoji_invalid')
    const { actor, post } = await requireReactable(ctx, args.targetKind, args.targetId)
    const mine = await ctx.db
      .query('pipReactions')
      .withIndex('by_target_user', (q) => q.eq('targetKind', args.targetKind).eq('targetId', args.targetId).eq('userId', actor._id))
      .collect()
    const existing = mine.find((r) => r.emoji === args.emoji)
    const delta = existing ? -1 : 1
    if (existing) await ctx.db.delete(existing._id)
    else await ctx.db.insert('pipReactions', { targetKind: args.targetKind, targetId: args.targetId, userId: actor._id, emoji: args.emoji, createdAt: Date.now() })
    if (args.targetKind === 'post') await ctx.db.patch(post._id, { reactionCount: Math.max(0, post.reactionCount + delta) })
    return { on: !existing }
  },
})

/** Who reacted with one emoji — leads only; members see counts and nothing more. */
export const reactors = query({
  args: { targetKind: vTargetKind, targetId: vTargetId, emoji: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'publish_pip')
    const rows = await ctx.db
      .query('pipReactions')
      .withIndex('by_target', (q) => q.eq('targetKind', args.targetKind).eq('targetId', args.targetId))
      .collect()
    const names: string[] = []
    for (const r of rows.filter((r) => r.emoji === args.emoji)) {
      const u = await ctx.db.get(r.userId)
      names.push(u?.name ?? u?.email ?? '')
    }
    return names
  },
})
