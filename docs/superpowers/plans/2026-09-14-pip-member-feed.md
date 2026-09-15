# PIP part 1: rules, data, and the member feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the PIP's backend (role, permissions, tables, rules, Convex functions, notifications) and the member's feed at `/pip`, folded from prototype variant E, so a lead can be seeded and a member can read, react and comment.

**Architecture:** Pure rule modules under `convex/lib/` (imported by both Convex and the browser, like `journalRules.ts` and `athleteAccess.ts`), one Convex module `convex/pip.ts` for every PIP read and write, and a `src/components/Pip/` folder whose components are rewritten from the prototype under production constraints (i18n through Paraglide, real data through Convex hooks, tests). Posts are released by a scheduled internal mutation; visibility is computed at read time from current group membership.

**Tech Stack:** Convex 1.45, TanStack Router file routes, React 19, Tailwind v4 utilities and the app's `.card`/`.chip`/`.btn` classes, Paraglide messages (`messages/es.json` + `messages/en.json`), Vitest (`unit` project for `tests/*.test.ts`, `components` project for `tests/components/*.test.tsx`), `react-markdown` + `remark-gfm` for rendering.

**Spec:** `docs/superpowers/specs/2026-09-14-pip-posts-groups-design.md`

**Not in this plan** (separate plans, same spec): the lead's screen `/administracion/pip` (composer, uploads with the availability check, groups UI), and the Tiptap editor for posts and the journal. This plan ships the mutations those screens will call, and a dev seed so the feed can be exercised before they exist.

## Global Constraints

- Post title ≤ **100** characters; body markdown ≤ **10 000**; comment ≤ **2 000** (spec §3, §5, §7). The journal's `TITLE_LIMIT` becomes **100** too (spec "What this reverses").
- Up to **10** attachments per post: images JPG/PNG/WebP ≤ **10 MB**, videos MP4/WebM ≤ **250 MB**, YouTube by video id (spec §4).
- Comment visibility per post: `'off' | 'lead' | 'group'`, default `'lead'`; a comment keeps the visibility it was written under (spec §5).
- Post states: `'draft' | 'scheduled' | 'published' | 'unpublished'` (spec §3). Delete only while `commentCount + reactionCount === 0`.
- Reactions: any emoji, several per member, on posts and top-level comments; counts to everyone, names to leads only (spec §5).
- Notifications in-app only, three kinds: `pip_post_published`, `pip_comment_reply`, `pip_comment_new` — the last batched as one unread per lead per post (spec §6).
- Roles and permissions are append-only tables (`PERMISSIONS` order is a tested promise). New role `pip_lead`; new permissions in this order: `view_members_basic`, `manage_pip_groups`, `publish_pip` (spec §1).
- Every error crosses the wire as an `AppErrorCode`; every code has an `err_*` message in **both** `messages/es.json` and `messages/en.json` (the `registrationErrors` test enforces it). Guards read a permission, never a role.
- Copy in the UI goes through Paraglide (`import * as m from '../paraglide/messages.js'`), never hard-coded strings. Spanish first, English mirrored.
- `pnpm check` (typecheck + all tests) must be green at every commit. `pnpm paraglide` regenerates messages after editing the JSON files (it runs automatically before `typecheck` and `test`).
- Commit messages follow the repo's voice: `type(scope): what the change makes true`, and end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

**Created**
- `convex/lib/pipRules.ts` — limits, validators, lifecycle transitions, emoji check, month keys, YouTube id and Zoom link parsing. Pure.
- `convex/lib/pipAccess.ts` — who may read a post, see a comment, comment, react. Pure.
- `convex/pip.ts` — every PIP Convex function: viewer resolution, groups helpers, post mutations, the release job, feed and months queries, comments, reactions, hide, the dev seed, `endPipGroupsForAthlete`.
- `src/components/Pip/Markdown.tsx` — the renderer (react-markdown + GFM, no raw HTML).
- `src/components/Pip/MediaGrid.tsx` — attachment tiles and the lightbox.
- `src/components/Pip/ReactionRow.tsx` — reaction chips and the picker with per-device recents.
- `src/components/Pip/PostThread.tsx` — a post's comments, replies, composer, one reply box at a time.
- `src/components/Pip/PostCard.tsx` — a post as a collapsible card (prototype E's `FoldRow`).
- `src/components/Pip/PipFeed.tsx` — toolbar (month select, kind chips) and the paginated list.
- `src/routes/pip.tsx` — the member route.
- `tests/pipRules.test.ts`, `tests/pipAccess.test.ts`, `tests/components/Markdown.test.tsx`, `tests/components/MediaGrid.test.tsx`, `tests/components/ReactionRow.test.tsx`, `tests/components/PostThread.test.tsx`, `tests/components/PostCard.test.tsx`, `tests/components/PipFeed.test.tsx`.

**Modified**
- `convex/lib/permissions.ts`, `tests/permissions.test.ts` — role and permissions.
- `convex/lib/staffRules.ts` (nothing to change: `normalizeStaffRoles` derives from `ROLES`), `src/components/Admin/RoleChecks.tsx` — label for the new role.
- `convex/lib/errorCodes.ts`, `src/lib/registrationErrors.ts`, `messages/es.json`, `messages/en.json` — codes, messages, UI copy.
- `convex/schema.ts` — role literal, five tables, notification kinds and fields.
- `convex/lib/notificationRules.ts`, `convex/notifications.ts`, `src/components/Notifications/NotificationItem.tsx`, `tests/notificationRules.test.ts` — the three kinds.
- `convex/registrations.ts:456` — end group memberships on removal.
- `convex/lib/journalRules.ts`, `tests/journalRules.test.ts` — `TITLE_LIMIT` 120 → 100.
- `src/components/AppBar/AccountNav.tsx` — the PIP link and the bell for leads.
- `src/routes/notificaciones.tsx`, `src/components/AppBar/NotificationsMenu.tsx` — no change needed; `targetFor` grows a `publicacion` search param and both already pass `t.search` through.
- `docs/DECISIONS.md` — the PIP decisions.
- `package.json` — `react-markdown`, `remark-gfm`.

---

### Task 1: Land the pending work and park the prototype

The working tree holds three unrelated things: the confirmations-card fix (from earlier today), the PIP spec, and prototype variants A–E. The prototype must survive on its own branch and leave `main`'s lineage; the fix and the spec go in as commits.

**Files:**
- Commit: `src/components/RegistrationForm/steps/Step8Confirmations.tsx`, `tests/components/RegistrationWizard.test.tsx`
- Commit: `docs/superpowers/specs/2026-09-14-pip-posts-groups-design.md`, `docs/superpowers/plans/2026-09-14-pip-member-feed.md`
- Park on `proto/pip-feed`: `src/components/Pip/prototype/*`, `src/routes/prototype.pip.tsx`, `src/routeTree.gen.ts`
- Leave untouched (the user's own, uncommitted): `documentation/erd.dio`, `documentation/ERD.excalidraw`

- [ ] **Step 1: Commit the confirmations fix on the current branch**

```bash
git add src/components/RegistrationForm/steps/Step8Confirmations.tsx tests/components/RegistrationWizard.test.tsx
git commit -m "fix(form): a confirmation card pressed on and off again says nothing before a send

The onChange rule was there to clear a message the moment a card is
accepted, but it also put one there the moment a card was unaccepted —
before anything had asked for it to be true. It now marks a card only
after a refused send, when the form is in change mode.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 2: Commit the spec and this plan**

```bash
git add docs/superpowers/specs/2026-09-14-pip-posts-groups-design.md docs/superpowers/plans/2026-09-14-pip-member-feed.md
git commit -m "docs(pip): the PIP design — posts, groups, comments, reactions — and the plan for its first part

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 3: Park the prototype on its own branch**

```bash
git switch -c proto/pip-feed
git add src/components/Pip/prototype src/routes/prototype.pip.tsx src/routeTree.gen.ts
git commit -m "proto(pip): five variants of the member's PIP feed

Throwaway. Answers one question: what does the member's feed look like?
  ?variant=a  Boletín — one reading column, a post is a letter
  ?variant=b  Programa — a month rail and kind filters, the newest post is a hero
  ?variant=c  Conversación — a timeline under the lead's face
  ?variant=d  Tarjeta — one card holds everything, under C's timeline (round 2)
  ?variant=e  Programa 2 — B without the rail: month select, kind chips (round 3)

Verdict: E, after three rounds. B's grouping and collapse won on a phone,
C's cleanliness on a laptop; round two put both in D and E; round three
made E's toolbar static, gave collapsed rows three lines and an
attachment summary, added a lightbox, and one reply box per thread.
Folded into feat/pip-feed; see docs/DECISIONS.md.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin proto/pip-feed
```

- [ ] **Step 4: Cut the feature branch without the prototype**

```bash
git switch -c feat/pip-feed feat/full-height-tables
git status --short
```

Expected: only `documentation/erd.dio` (modified) and `documentation/ERD.excalidraw` (untracked) remain, both the user's. `src/components/Pip/` must not exist. Run `pnpm generate-routes` so `src/routeTree.gen.ts` no longer lists `/prototype/pip`, then confirm with `git diff --stat` that it is unchanged from the branch point.

- [ ] **Step 5: Verify green**

Run: `pnpm check`
Expected: typecheck clean, every test passing.

---

### Task 2: The role and the permissions

**Files:**
- Modify: `convex/lib/permissions.ts`
- Modify: `convex/schema.ts:10-17` (`vRole`)
- Modify: `src/components/Admin/RoleChecks.tsx:5-11`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/permissions.test.ts`

**Interfaces:**
- Produces: role `'pip_lead'` in `ROLES`; permissions `'view_members_basic' | 'manage_pip_groups' | 'publish_pip'` appended to `PERMISSIONS`; `can(roles, 'publish_pip')` is how every later task asks "is this a lead".

- [ ] **Step 1: Write the failing tests**

Append to `tests/permissions.test.ts` inside `describe('the permission table', …)`:

```ts
  it('gives the PIP lead its three permissions and nothing of the journal', () => {
    expect(permissionsOf(['pip_lead'])).toEqual(['view_members_basic', 'manage_pip_groups', 'publish_pip'])
    expect(can(['pip_lead'], 'view_all_athletes')).toBe(false)
    expect(can(['pip_lead'], 'comment_journal')).toBe(false)
    expect(can(['pip_lead'], 'review_registrations')).toBe(false)
  })

  it('keeps admin, coach and health out of the PIP', () => {
    for (const role of ['admin', 'coach', 'health', 'finance', 'athlete'] as const) {
      expect(can([role], 'publish_pip')).toBe(false)
      expect(can([role], 'manage_pip_groups')).toBe(false)
      expect(can([role], 'view_members_basic')).toBe(false)
    }
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/permissions.test.ts`
Expected: FAIL — `'pip_lead'` is not assignable to `Role`, and the three permissions are unknown.

- [ ] **Step 3: Add the role and the permissions**

In `convex/lib/permissions.ts`:

```ts
export const ROLES = ['athlete', 'admin', 'master_admin', 'coach', 'finance', 'health', 'pip_lead'] as const
```

Append to `PERMISSIONS`, after `'remove_athletes'`:

```ts
  // The PIP. Appended, never reordered.
  'view_members_basic',
  'manage_pip_groups',
  'publish_pip',
```

Add to `GRANTS`, after `health`:

```ts
  // The lead publishes to members and builds groups from a basic list —
  // names, rama, age — and reads nothing of the journal. See the PIP spec §1.
  pip_lead: ['view_members_basic', 'manage_pip_groups', 'publish_pip'],
```

`master_admin: PERMISSIONS` already covers the master admin.

In `convex/schema.ts` add `v.literal('pip_lead'),` after `v.literal('health'),` inside `vRole`.

In `src/components/Admin/RoleChecks.tsx` add `pip_lead: m.role_pip_lead,` to `ROLE_LABEL`.

In `messages/es.json` after `"role_health": "Salud",` add `"role_pip_lead": "Encargada del PIP",`; in `messages/en.json` add `"role_pip_lead": "PIP lead",`.

- [ ] **Step 4: Run the tests**

Run: `pnpm check`
Expected: PASS. (`normalizeStaffRoles` in `staffRules.ts` derives from `ROLES`, so the invite dialog offers the new role with no further change; `canBeAssigned` excludes it because it lacks `view_assigned_athletes`.)

- [ ] **Step 5: Commit**

```bash
git add convex/lib/permissions.ts convex/schema.ts src/components/Admin/RoleChecks.tsx messages/es.json messages/en.json tests/permissions.test.ts
git commit -m "feat(pip): the pip_lead role, with three permissions and nothing of the journal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Error codes and their sentences

**Files:**
- Modify: `convex/lib/errorCodes.ts` (the `ActionErrorCode` union, before `| 'generic'`)
- Modify: `src/lib/registrationErrors.ts` (the `MESSAGES` record, before `generic:`)
- Modify: `messages/es.json`, `messages/en.json`
- Modify: `convex/lib/journalRules.ts:13`, `tests/journalRules.test.ts`

**Interfaces:**
- Produces: the codes every PIP mutation and rule may return (listed below).

- [ ] **Step 1: Add the codes**

In `convex/lib/errorCodes.ts`, before `/** Nothing more specific survived the trip. …`:

```ts
  // The PIP.
  | 'post_not_found'
  | 'post_title_required'
  | 'post_title_too_long'
  | 'post_body_required'
  | 'post_body_too_long'
  | 'post_attachments_too_many'
  | 'post_status_invalid'
  | 'post_schedule_past'
  | 'post_has_activity'
  | 'comments_off'
  | 'pip_comment_not_found'
  | 'emoji_invalid'
  | 'group_not_found'
  | 'group_name_required'
  | 'group_name_too_long'
  | 'group_archived'
```

- [ ] **Step 2: Add the messages**

`messages/es.json`, after `"err_notification_not_found"`:

```json
  "err_post_not_found": "No encontramos esa publicación.",
  "err_post_title_required": "Escribe el título.",
  "err_post_title_too_long": "El título no puede pasar de {limit} caracteres.",
  "err_post_body_required": "Escribe el contenido.",
  "err_post_body_too_long": "El contenido no puede pasar de {limit} caracteres.",
  "err_post_attachments_too_many": "Una publicación lleva como máximo {limit} adjuntos.",
  "err_post_status_invalid": "Esa publicación no puede pasar a ese estado desde el que tiene.",
  "err_post_schedule_past": "La fecha de publicación tiene que ser futura.",
  "err_post_has_activity": "Ya tiene reacciones o comentarios: despublícala en lugar de borrarla.",
  "err_comments_off": "Esta publicación no admite comentarios.",
  "err_pip_comment_not_found": "No encontramos ese comentario.",
  "err_emoji_invalid": "Eso no es un emoji.",
  "err_group_not_found": "No encontramos ese grupo.",
  "err_group_name_required": "Escribe el nombre del grupo.",
  "err_group_name_too_long": "El nombre del grupo no puede pasar de {limit} caracteres.",
  "err_group_archived": "Ese grupo está archivado.",
```

`messages/en.json`, same place:

```json
  "err_post_not_found": "We couldn't find that post.",
  "err_post_title_required": "Write the title.",
  "err_post_title_too_long": "The title can't be longer than {limit} characters.",
  "err_post_body_required": "Write the content.",
  "err_post_body_too_long": "The content can't be longer than {limit} characters.",
  "err_post_attachments_too_many": "A post carries at most {limit} attachments.",
  "err_post_status_invalid": "That post can't move to that state from the one it's in.",
  "err_post_schedule_past": "The release date has to be in the future.",
  "err_post_has_activity": "It already has reactions or comments: unpublish it instead of deleting it.",
  "err_comments_off": "This post doesn't take comments.",
  "err_pip_comment_not_found": "We couldn't find that comment.",
  "err_emoji_invalid": "That's not an emoji.",
  "err_group_not_found": "We couldn't find that group.",
  "err_group_name_required": "Write the group's name.",
  "err_group_name_too_long": "The group's name can't be longer than {limit} characters.",
  "err_group_archived": "That group is archived.",
```

- [ ] **Step 3: Map the codes**

In `src/lib/registrationErrors.ts`, add to the imports:

```ts
import { ATTACHMENT_LIMIT, GROUP_NAME_LIMIT, POST_BODY_LIMIT, POST_TITLE_LIMIT } from '../../convex/lib/pipRules'
```

(`pipRules.ts` is created in Task 4; write this task's code now and run the check after Task 4 — or create the file first with only the four constants. Do the latter: create `convex/lib/pipRules.ts` containing exactly the `Limits` block from Task 4 Step 3, then fill the rest in Task 4.)

Add to `MESSAGES`, before `generic:`:

```ts
  // The PIP.
  post_not_found: m.err_post_not_found,
  post_title_required: m.err_post_title_required,
  post_title_too_long: () => m.err_post_title_too_long({ limit: POST_TITLE_LIMIT }),
  post_body_required: m.err_post_body_required,
  post_body_too_long: () => m.err_post_body_too_long({ limit: POST_BODY_LIMIT }),
  post_attachments_too_many: () => m.err_post_attachments_too_many({ limit: ATTACHMENT_LIMIT }),
  post_status_invalid: m.err_post_status_invalid,
  post_schedule_past: m.err_post_schedule_past,
  post_has_activity: m.err_post_has_activity,
  comments_off: m.err_comments_off,
  pip_comment_not_found: m.err_pip_comment_not_found,
  emoji_invalid: m.err_emoji_invalid,
  group_not_found: m.err_group_not_found,
  group_name_required: m.err_group_name_required,
  group_name_too_long: () => m.err_group_name_too_long({ limit: GROUP_NAME_LIMIT }),
  group_archived: m.err_group_archived,
```

- [ ] **Step 4: The journal's title limit becomes 100**

`convex/lib/journalRules.ts`: `export const TITLE_LIMIT = 100`. In `tests/journalRules.test.ts` nothing references the number directly (it uses `TITLE_LIMIT`), so the test stays; add one assertion to the "wants a title, within the limit" case so the number is pinned:

```ts
    expect(TITLE_LIMIT).toBe(100)
```

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: PASS once Task 4's constants exist. The `registrationErrors` test walks every code's sentence in both locales.

- [ ] **Step 6: Commit** (together with Task 4, see there)

---

### Task 4: `pipRules` — the pure rules

**Files:**
- Create: `convex/lib/pipRules.ts`
- Test: `tests/pipRules.test.ts`

**Interfaces:**
- Produces:
  - `POST_KINDS`, `PostKind`, `POST_STATUSES`, `PostStatus`, `COMMENT_VISIBILITIES`, `CommentsVisibility`
  - `POST_TITLE_LIMIT = 100`, `POST_BODY_LIMIT = 10_000`, `PIP_COMMENT_LIMIT = 2000`, `ATTACHMENT_LIMIT = 10`, `GROUP_NAME_LIMIT = 60`, `IMAGE_MAX_BYTES`, `VIDEO_MAX_BYTES`, `IMAGE_TYPES`, `VIDEO_TYPES`
  - `validatePost(input: PostInput): AppErrorCode | null`
  - `validatePipComment(body: string): AppErrorCode | null`
  - `validateGroupName(name: string): AppErrorCode | null`
  - `canDeletePost(p: { commentCount: number; reactionCount: number }): AppErrorCode | null`
  - `checkTransition(from: PostStatus, to: PostStatus, opts: { scheduledFor?: number; now: number }): AppErrorCode | null`
  - `isEmoji(s: string): boolean`
  - `youtubeIdFrom(url: string): string | null`
  - `zoomLinkIn(body: string): string | null`
  - `monthKeyOf(ms: number): string` (Mexico City `YYYY-MM`), `monthRange(key: string): { from: number; to: number } | null`

- [ ] **Step 1: Write the failing tests**

`tests/pipRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_LIMIT,
  POST_BODY_LIMIT,
  POST_TITLE_LIMIT,
  PIP_COMMENT_LIMIT,
  canDeletePost,
  checkTransition,
  isEmoji,
  monthKeyOf,
  monthRange,
  validateGroupName,
  validatePipComment,
  validatePost,
  youtubeIdFrom,
  zoomLinkIn,
} from '../convex/lib/pipRules'

const ok = {
  kind: 'content' as const,
  title: 'Manejo de la frustración',
  body: '## Este mes\n\nQué hacemos con el error.',
  commentsVisibility: 'lead' as const,
  attachmentCount: 2,
}

describe('validatePost', () => {
  it('accepts a whole post', () => {
    expect(validatePost(ok)).toBeNull()
  })

  it('wants a title within 100', () => {
    expect(validatePost({ ...ok, title: '  ' })).toBe('post_title_required')
    expect(validatePost({ ...ok, title: 'x'.repeat(POST_TITLE_LIMIT + 1) })).toBe('post_title_too_long')
    expect(validatePost({ ...ok, title: 'x'.repeat(POST_TITLE_LIMIT) })).toBeNull()
    expect(POST_TITLE_LIMIT).toBe(100)
  })

  it('wants a body within 10 000', () => {
    expect(validatePost({ ...ok, body: '' })).toBe('post_body_required')
    expect(validatePost({ ...ok, body: 'x'.repeat(POST_BODY_LIMIT + 1) })).toBe('post_body_too_long')
  })

  it('takes at most ten attachments', () => {
    expect(validatePost({ ...ok, attachmentCount: ATTACHMENT_LIMIT })).toBeNull()
    expect(validatePost({ ...ok, attachmentCount: ATTACHMENT_LIMIT + 1 })).toBe('post_attachments_too_many')
  })
})

describe('validatePipComment and validateGroupName', () => {
  it('wants a comment within 2 000', () => {
    expect(validatePipComment('  ')).toBe('comment_required')
    expect(validatePipComment('x'.repeat(PIP_COMMENT_LIMIT + 1))).toBe('comment_too_long')
    expect(validatePipComment('Lo noté en los par 3.')).toBeNull()
  })

  it('wants a group name within 60', () => {
    expect(validateGroupName('')).toBe('group_name_required')
    expect(validateGroupName('x'.repeat(61))).toBe('group_name_too_long')
    expect(validateGroupName('XUNTAS · menores')).toBeNull()
  })
})

describe('canDeletePost', () => {
  it('refuses once anything has been said or felt', () => {
    expect(canDeletePost({ commentCount: 0, reactionCount: 0 })).toBeNull()
    expect(canDeletePost({ commentCount: 1, reactionCount: 0 })).toBe('post_has_activity')
    expect(canDeletePost({ commentCount: 0, reactionCount: 3 })).toBe('post_has_activity')
  })
})

describe('checkTransition', () => {
  const now = Date.parse('2026-09-14T18:00:00.000Z')

  it('lets a draft be scheduled for the future or published now', () => {
    expect(checkTransition('draft', 'scheduled', { scheduledFor: now + 60_000, now })).toBeNull()
    expect(checkTransition('draft', 'scheduled', { scheduledFor: now - 1, now })).toBe('post_schedule_past')
    expect(checkTransition('draft', 'scheduled', { now })).toBe('post_schedule_past')
    expect(checkTransition('draft', 'published', { now })).toBeNull()
  })

  it('lets a scheduled post go back to draft or out now, and nothing else', () => {
    expect(checkTransition('scheduled', 'draft', { now })).toBeNull()
    expect(checkTransition('scheduled', 'published', { now })).toBeNull()
    expect(checkTransition('scheduled', 'unpublished', { now })).toBe('post_status_invalid')
  })

  it('unpublishes only what is published, and republishes only what was unpublished', () => {
    expect(checkTransition('published', 'unpublished', { now })).toBeNull()
    expect(checkTransition('published', 'draft', { now })).toBe('post_status_invalid')
    expect(checkTransition('unpublished', 'published', { now })).toBeNull()
    expect(checkTransition('unpublished', 'scheduled', { scheduledFor: now + 1, now })).toBe('post_status_invalid')
  })
})

describe('isEmoji', () => {
  it('takes one emoji, with skin tones and joiners, and nothing else', () => {
    expect(isEmoji('🔥')).toBe(true)
    expect(isEmoji('👍🏽')).toBe(true)
    expect(isEmoji('🏌️‍♀️')).toBe(true)
    expect(isEmoji('❤️')).toBe(true)
    expect(isEmoji('🔥🔥')).toBe(false)
    expect(isEmoji('a')).toBe(false)
    expect(isEmoji('')).toBe(false)
    expect(isEmoji('<script>')).toBe(false)
  })
})

describe('youtubeIdFrom', () => {
  it('reads the id off the forms people paste', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    ]) {
      expect(youtubeIdFrom(u)).toBe('dQw4w9WgXcQ')
    }
    expect(youtubeIdFrom('https://vimeo.com/123')).toBeNull()
    expect(youtubeIdFrom('dQw4w9WgXcQ')).toBeNull()
  })
})

describe('zoomLinkIn', () => {
  it('finds the first zoom.us link in a body', () => {
    expect(zoomLinkIn('Entra por aquí: https://zoom.us/j/000000001 a las 17:00')).toBe('https://zoom.us/j/000000001')
    expect(zoomLinkIn('https://us02web.zoom.us/j/1?pwd=abc)')).toBe('https://us02web.zoom.us/j/1?pwd=abc')
    expect(zoomLinkIn('Sin liga.')).toBeNull()
  })
})

describe('month keys', () => {
  it('names the month in Mexico City, not UTC', () => {
    // 03:00 UTC on the 1st of October is still 21:00 on 30 September in Mexico City.
    expect(monthKeyOf(Date.parse('2026-10-01T03:00:00.000Z'))).toBe('2026-09')
    expect(monthKeyOf(Date.parse('2026-10-01T07:00:00.000Z'))).toBe('2026-10')
  })

  it('turns a key back into a half-open range of ms', () => {
    const r = monthRange('2026-09')!
    expect(monthKeyOf(r.from)).toBe('2026-09')
    expect(monthKeyOf(r.to - 1)).toBe('2026-09')
    expect(monthKeyOf(r.to)).toBe('2026-10')
    expect(monthRange('septiembre')).toBeNull()
    expect(monthRange('2026-13')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/pipRules.test.ts`
Expected: FAIL — module missing (or, if the constants stub from Task 3 exists, every function missing).

- [ ] **Step 3: Write the module**

`convex/lib/pipRules.ts`:

```ts
import type { AppErrorCode } from './errorCodes'
import { MX_OFFSET_MS } from './cycleRules'

/**
 * The rules of the PIP, as pure functions returning codes. `pip.ts` runs
 * them before writing; the lead's composer will run them for immediate
 * feedback. Same shape as `journalRules.ts`.
 */

// --- Limits -----------------------------------------------------------------

export const POST_KINDS = ['content', 'session', 'challenge'] as const
export type PostKind = (typeof POST_KINDS)[number]

export const POST_STATUSES = ['draft', 'scheduled', 'published', 'unpublished'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const COMMENT_VISIBILITIES = ['off', 'lead', 'group'] as const
export type CommentsVisibility = (typeof COMMENT_VISIBILITIES)[number]

export const POST_TITLE_LIMIT = 100
export const POST_BODY_LIMIT = 10_000
export const PIP_COMMENT_LIMIT = 2000
export const ATTACHMENT_LIMIT = 10
export const GROUP_NAME_LIMIT = 60
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const VIDEO_MAX_BYTES = 250 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const

// --- Validation --------------------------------------------------------------

export type PostInput = {
  kind: PostKind
  title: string
  body: string
  commentsVisibility: CommentsVisibility
  attachmentCount: number
}

export function validatePost(input: PostInput): AppErrorCode | null {
  const title = input.title.trim()
  if (!title) return 'post_title_required'
  if (title.length > POST_TITLE_LIMIT) return 'post_title_too_long'
  const body = input.body.trim()
  if (!body) return 'post_body_required'
  if (body.length > POST_BODY_LIMIT) return 'post_body_too_long'
  if (input.attachmentCount > ATTACHMENT_LIMIT) return 'post_attachments_too_many'
  return null
}

export function validatePipComment(body: string): AppErrorCode | null {
  const text = body.trim()
  if (!text) return 'comment_required'
  if (text.length > PIP_COMMENT_LIMIT) return 'comment_too_long'
  return null
}

export function validateGroupName(name: string): AppErrorCode | null {
  const text = name.trim()
  if (!text) return 'group_name_required'
  if (text.length > GROUP_NAME_LIMIT) return 'group_name_too_long'
  return null
}

/** A post with reactions or comments stays: unpublish hides it, delete would take the words with it. */
export function canDeletePost(p: { commentCount: number; reactionCount: number }): AppErrorCode | null {
  return p.commentCount + p.reactionCount > 0 ? 'post_has_activity' : null
}

// --- Lifecycle ----------------------------------------------------------------

const NEXT: Record<PostStatus, readonly PostStatus[]> = {
  draft: ['scheduled', 'published'],
  scheduled: ['draft', 'published'],
  published: ['unpublished'],
  unpublished: ['published'],
}

/**
 * Four explicit states. A draft has no release; scheduling needs a future
 * moment; a stale job publishing a post that was moved back to draft is
 * refused by `pip.release` re-reading the status, not here.
 */
export function checkTransition(
  from: PostStatus,
  to: PostStatus,
  opts: { scheduledFor?: number; now: number },
): AppErrorCode | null {
  if (!NEXT[from].includes(to)) return 'post_status_invalid'
  if (to === 'scheduled' && !(opts.scheduledFor !== undefined && opts.scheduledFor > opts.now)) {
    return 'post_schedule_past'
  }
  return null
}

// --- Parsing ------------------------------------------------------------------

/**
 * One emoji: a single grapheme whose first scalar is pictographic. Skin
 * tones, joiner sequences and the variation selector all count as one
 * grapheme, which is what `Intl.Segmenter` is for.
 */
export function isEmoji(s: string): boolean {
  if (!s) return false
  const graphemes = [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(s)]
  if (graphemes.length !== 1) return false
  return /^\p{Extended_Pictographic}/u.test(s)
}

const YOUTUBE = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})(?:[&?#].*)?$/

export function youtubeIdFrom(url: string): string | null {
  const m = url.trim().match(YOUTUBE)
  return m ? m[1] : null
}

const ZOOM = /https?:\/\/[\w.-]*zoom\.us\/[^\s)]+/i

export function zoomLinkIn(body: string): string | null {
  return body.match(ZOOM)?.[0] ?? null
}

// --- Months -------------------------------------------------------------------

/** `YYYY-MM` of a moment, in Mexico City. */
export function monthKeyOf(ms: number): string {
  const d = new Date(ms - MX_OFFSET_MS)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** The half-open `[from, to)` in ms a month key covers, in Mexico City; null for anything that is not a key. */
export function monthRange(key: string): { from: number; to: number } | null {
  const m = key.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  return { from: Date.UTC(y, mo - 1, 1) + MX_OFFSET_MS, to: Date.UTC(y, mo, 1) + MX_OFFSET_MS }
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm check`
Expected: PASS, including Task 3's error-message test.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/pipRules.ts tests/pipRules.test.ts convex/lib/errorCodes.ts src/lib/registrationErrors.ts messages/es.json messages/en.json convex/lib/journalRules.ts tests/journalRules.test.ts
git commit -m "feat(pip): the rules — limits, lifecycle, emoji, YouTube ids, Zoom links, Mexico City months

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `pipAccess` — who reads what

**Files:**
- Create: `convex/lib/pipAccess.ts`
- Test: `tests/pipAccess.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PipViewer = { userId: string; isMember: boolean; isLead: boolean; groupIds: readonly string[] }
  export function canReadPost(post: { status: PostStatus; groupIds: readonly string[] }, v: PipViewer): boolean
  export function canSeeComment(c: { authorId: string; visibility: 'lead' | 'group'; hidden: boolean }, v: PipViewer): boolean
  export function canCommentOn(post: { status: PostStatus; commentsVisibility: CommentsVisibility }, v: PipViewer): boolean
  export function canReact(post: { status: PostStatus }, v: PipViewer): boolean
  ```
  `isLead` means `can(roles, 'publish_pip')` — a `pip_lead` or a `master_admin`. The read-only rule for a master admin is the screen's, not these functions'.

- [ ] **Step 1: Write the failing tests**

`tests/pipAccess.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/pipAccess.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the module**

`convex/lib/pipAccess.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run tests/pipAccess.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/pipAccess.ts tests/pipAccess.test.ts
git commit -m "feat(pip): who reads a post, sees a comment, may comment and react — as one pure table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The tables

**Files:**
- Modify: `convex/schema.ts` — five tables after `notifications`, plus the notification changes

**Interfaces:**
- Produces the documents every Convex function in Tasks 7–9 reads and writes. Exact field names below are the contract.

- [ ] **Step 1: Add the validators and tables**

After `vNoticeStatus` near the top of `convex/schema.ts`:

```ts
export const vPostKind = v.union(v.literal('content'), v.literal('session'), v.literal('challenge'))
export const vPostStatus = v.union(
  v.literal('draft'),
  v.literal('scheduled'),
  v.literal('published'),
  v.literal('unpublished'),
)
export const vCommentsVisibility = v.union(v.literal('off'), v.literal('lead'), v.literal('group'))
/** One attachment. A stored file keeps its name for the caption; a YouTube video keeps only its id, and the flag the attach-time check set. */
export const vAttachment = v.union(
  v.object({ type: v.literal('image'), storageId: v.id('_storage'), name: v.string() }),
  v.object({ type: v.literal('video'), storageId: v.id('_storage'), name: v.string() }),
  v.object({ type: v.literal('youtube'), videoId: v.string(), unavailable: v.optional(v.boolean()) }),
)
```

Append inside `defineSchema({ … })`, after the `notifications` table:

```ts
  /**
   * The PIP — see docs/superpowers/specs/2026-09-14-pip-posts-groups-design.md.
   *
   * A group is the lead's word for "who gets this". Renamed and archived,
   * never deleted, so an old post still says who it went to. "Todos los
   * miembros" is not a row: a post with no `groupIds` reaches every member.
   */
  pipGroups: defineTable({
    name: v.string(),
    createdBy: v.id('users'),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index('by_archived', ['archivedAt']),

  /** Membership rows are ended, never deleted — the same as assignments. */
  pipGroupMembers: defineTable({
    groupId: v.id('pipGroups'),
    athleteUserId: v.id('users'),
    addedBy: v.id('users'),
    addedAt: v.number(),
    removedAt: v.optional(v.number()),
  })
    .index('by_group_active', ['groupId', 'removedAt'])
    .index('by_athlete_active', ['athleteUserId', 'removedAt']),

  /**
   * One shape of post. `kind` changes an icon and an eyebrow, nothing else.
   * `groupIds` empty means everyone. Visibility is computed at read time
   * from current membership, never fanned out. `commentCount` and
   * `reactionCount` are kept by the mutations so the feed says "3
   * comentarios" without a query per card and delete can refuse without
   * one either.
   */
  pipPosts: defineTable({
    authorId: v.id('users'),
    kind: vPostKind,
    title: v.string(),
    /** Markdown, the subset in the spec §7. */
    body: v.string(),
    attachments: v.array(vAttachment),
    groupIds: v.array(v.id('pipGroups')),
    commentsVisibility: vCommentsVisibility,
    status: vPostStatus,
    scheduledFor: v.optional(v.number()),
    /** The release job, so a rescheduling can cancel it. */
    scheduledJobId: v.optional(v.id('_scheduled_functions')),
    publishedAt: v.optional(v.number()),
    editedAt: v.optional(v.number()),
    unpublishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    commentCount: v.number(),
    reactionCount: v.number(),
  })
    .index('by_status_published', ['status', 'publishedAt'])
    .index('by_status_scheduled', ['status', 'scheduledFor']),

  /**
   * One level: a comment, and replies to it (`parentId`). `visibility` is
   * copied from the post at write time and never follows a later change.
   * A hidden comment stays, for its author (marked) and for leads.
   */
  pipComments: defineTable({
    postId: v.id('pipPosts'),
    parentId: v.optional(v.id('pipComments')),
    authorId: v.id('users'),
    body: v.string(),
    visibility: v.union(v.literal('lead'), v.literal('group')),
    hiddenAt: v.optional(v.number()),
    hiddenBy: v.optional(v.id('users')),
    createdAt: v.number(),
    replyCount: v.number(),
  }).index('by_post_parent', ['postId', 'parentId']),

  /** Any emoji, several per member, on a post or a top-level comment. One row per (target, user, emoji). */
  pipReactions: defineTable({
    targetKind: v.union(v.literal('post'), v.literal('comment')),
    targetId: v.union(v.id('pipPosts'), v.id('pipComments')),
    userId: v.id('users'),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index('by_target', ['targetKind', 'targetId'])
    .index('by_target_user', ['targetKind', 'targetId', 'userId']),
```

- [ ] **Step 2: Grow the notifications table**

In the `notifications` table: add three literals to `kind` after `v.literal('assignment_ended'),`:

```ts
      v.literal('pip_post_published'),
      v.literal('pip_comment_reply'),
      v.literal('pip_comment_new'),
```

Make `athleteId` optional and add `postId` after `commentId`:

```ts
    /** Absent on PIP rows, which are about a post rather than a person. */
    athleteId: v.optional(v.id('users')),
    entryId: v.optional(v.id('journalEntries')),
    commentId: v.optional(v.id('journalComments')),
    postId: v.optional(v.id('pipPosts')),
```

- [ ] **Step 3: Push the schema and typecheck**

Run: `pnpm exec convex dev --once` (from this checkout; the memory note says a worktree must push from itself) then `pnpm exec tsc --noEmit`.
Expected: the deployment accepts the additive schema; `tsc` reports errors only in `convex/notifications.ts` (`describe` reads `n.athleteId` as required) and `src/components/Notifications/NotificationItem.tsx` — both fixed in Task 9. If `tsc` fails elsewhere, fix it before continuing.

- [ ] **Step 4: Commit** (together with Task 7)

---

### Task 7: `convex/pip.ts` — viewer, groups, posts, release, feed

Convex functions are not unit-tested in this repo (the rules under them are); this task is verified by `tsc`, a schema push, and the seed in Task 12 driven from the browser. Keep every decision in the pure modules so this file only fetches and calls.

**Files:**
- Create: `convex/pip.ts`

**Interfaces:**
- Consumes: `requireUser`, `requirePermission`, `fail` from `./auth`; `membershipOf` from `./members`; `can`, `permissionsOf` from `./lib/permissions`; everything from `./lib/pipRules` and `./lib/pipAccess`; `notify` from `./notifications` (Task 9 adds the PIP events — until then the two `notify` calls below do not compile; write them as shown and finish Task 9 before typechecking, or do Task 9 first).
- Produces (public API the feed uses):
  ```ts
  api.pip.feed({ month?: string, kind?: PostKind, paginationOpts })  → { page: PostView[], isDone, continueCursor }
  api.pip.months({})                                                  → { key: string; count: number }[]
  api.pip.post({ id })                                                → PostView | null
  ```
  and the writes the lead's screen will call later:
  `createPost`, `updatePost`, `setSchedule`, `publishNow`, `unpublish`, `republish`, `deletePost`, `createGroup`, `renameGroup`, `archiveGroup`, `setGroupMembers`.
  `PostView` is:
  ```ts
  type AttachmentView =
    | { type: 'image' | 'video'; url: string | null; name: string }
    | { type: 'youtube'; videoId: string; unavailable: boolean }
  type PostView = {
    _id: Id<'pipPosts'>; kind: PostKind; title: string; body: string
    authorName: string; publishedAt: number; editedAt?: number
    commentsVisibility: CommentsVisibility; attachments: AttachmentView[]
    reactions: { emoji: string; count: number; mine: boolean }[]
    /** Comments the viewer would see, top-level plus replies. */
    commentCount: number
  }
  ```

- [ ] **Step 1: Write the module**

`convex/pip.ts`:

```ts
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

/** How many comments this viewer would see under the post — replies included. */
async function visibleCommentCount(ctx: QueryCtx, postId: Id<'pipPosts'>, viewer: PipViewer): Promise<number> {
  const rows = await ctx.db
    .query('pipComments')
    .withIndex('by_post_parent', (q) => q.eq('postId', postId))
    .collect()
  return rows.filter((c) => canSeeComment({ authorId: c.authorId, visibility: c.visibility, hidden: c.hiddenAt !== undefined }, viewer)).length
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
```

The comments, reactions and hide functions, and the seed, are appended to this same file in Tasks 8 and 12.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: errors only about `notify`'s event type (`pip_published` unknown) and the `about` shape (`postId`). Task 9 resolves them; proceed to Task 8 and then Task 9 before committing.

---

### Task 8: Comments, reactions, hide

**Files:**
- Modify: `convex/pip.ts` (append)

**Interfaces:**
- Produces:
  ```ts
  api.pip.comments({ postId })                                   → { canComment: boolean; comments: CommentView[] }
  api.pip.addComment({ postId, body, parentId? })                → { id }
  api.pip.deleteComment({ id })                                  → { ok: true }
  api.pip.hideComment({ id, hidden: boolean })                   → { ok: true }   // publish_pip
  api.pip.react({ targetKind: 'post' | 'comment', targetId, emoji }) → { on: boolean }
  api.pip.reactors({ targetKind, targetId, emoji })              → string[]      // names, publish_pip only
  type CommentView = {
    _id: Id<'pipComments'>; authorName: string; isLead: boolean; isMine: boolean
    /** The author has since left the programme. */
    inactive: boolean
    body: string; createdAt: number; visibility: 'lead' | 'group'; hidden: boolean
    reactions: { emoji: string; count: number; mine: boolean }[]
    replies: CommentView[]   // empty on a reply
  }
  ```

- [ ] **Step 1: Append to `convex/pip.ts`**

```ts
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

async function commentView(ctx: QueryCtx, c: Doc<'pipComments'>, viewer: PipViewer, replies: Doc<'pipComments'>[]) {
  const author = await ctx.db.get(c.authorId)
  const authorIsLead = author ? can(author.roles, 'publish_pip') : false
  const inactive = !authorIsLead && (await membershipOf(ctx, c.authorId)) === null
  const visibleReplies = replies.filter((r) =>
    canSeeComment({ authorId: r.authorId, visibility: r.visibility, hidden: r.hiddenAt !== undefined }, viewer),
  )
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
    const all = await ctx.db
      .query('pipComments')
      .withIndex('by_post_parent', (q) => q.eq('postId', post._id))
      .collect()
    const top = all.filter((c) => c.parentId === undefined)
    const byParent = new Map<Id<'pipComments'>, Doc<'pipComments'>[]>()
    for (const c of all) {
      if (c.parentId) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c])
    }
    const visible = top.filter((c) =>
      canSeeComment({ authorId: c.authorId, visibility: c.visibility, hidden: c.hiddenAt !== undefined }, viewer),
    )
    return {
      canComment: canCommentOn(post, viewer),
      comments: await Promise.all(visible.map((c) => commentView(ctx, c, viewer, byParent.get(c._id) ?? []))),
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
      if (!canSeeComment({ authorId: parent.authorId, visibility: parent.visibility, hidden: parent.hiddenAt !== undefined }, viewer)) {
        fail('pip_comment_not_found')
      }
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
    if (!canSeeComment({ authorId: c.authorId, visibility: c.visibility, hidden: c.hiddenAt !== undefined }, viewer)) fail('pip_comment_not_found')
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
```

- [ ] **Step 2: Typecheck** — same expectation as Task 7 Step 2; Task 9 closes it.

---

### Task 9: The three notifications

**Files:**
- Modify: `convex/lib/notificationRules.ts`
- Modify: `convex/notifications.ts` (`notify`, `describe`)
- Modify: `src/components/Notifications/NotificationItem.tsx`
- Modify: `src/components/AppBar/AccountNav.tsx:81` (bell for leads — covered by `canReceiveNotifications`)
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/notificationRules.test.ts`

**Interfaces:**
- Consumes: the `notify` calls written in Tasks 7 and 8:
  `notify(ctx, { type: 'pip_published', actorId, memberIds }, { postId })` and
  `notify(ctx, { type: 'pip_comment', actorId, actorIsLead, parentAuthorId?, leadIds }, { postId })`.
- Produces: kinds `pip_post_published | pip_comment_reply | pip_comment_new`; `targetFor` → `{ to: '/pip', search: { publicacion } }` for a member and `{ to: '/administracion/pip', search: { publicacion } }` for a lead; `NotificationTarget.search` widened.

- [ ] **Step 1: Write the failing tests**

Append to `tests/notificationRules.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run tests/notificationRules.test.ts`
Expected: FAIL on the new event types and target fields.

- [ ] **Step 3: Extend the rules**

In `convex/lib/notificationRules.ts`:

```ts
export const NOTIFICATION_KINDS = [
  'entry_comment',
  'entry_reply',
  'general_comment',
  'general_reply',
  'entry_created',
  'assignment_created',
  'assignment_ended',
  'pip_post_published',
  'pip_comment_reply',
  'pip_comment_new',
] as const
```

Add two members to `NotificationEvent`:

```ts
  | { type: 'pip_published'; actorId: string; memberIds: readonly string[] }
  | {
      type: 'pip_comment'
      actorId: string
      actorIsLead: boolean
      /** The top-level comment's author, when this is a reply. */
      parentAuthorId?: string
      /** Everyone holding `publish_pip`. */
      leadIds: readonly string[]
    }
```

Add two cases to the `switch` in `recipientsFor`, before the closing brace:

```ts
    case 'pip_published':
      for (const id of event.memberIds) add(id, 'pip_post_published')
      break
    case 'pip_comment': {
      // The parent author hears a reply. The leads hear "new comments" —
      // once per post, which `notify` enforces — unless the lead is the one
      // writing, in which case only the parent author hears.
      if (event.parentAuthorId) add(event.parentAuthorId, 'pip_comment_reply')
      if (!event.actorIsLead) for (const id of event.leadIds) add(id, 'pip_comment_new')
      break
    }
```

Replace `canReceiveNotifications`:

```ts
/** A member, anyone who may write in a journal, or a PIP lead. Finance never has a bell. */
export function canReceiveNotifications(roles: readonly Role[], isMember: boolean): boolean {
  return isMember || can(roles, 'comment_journal') || can(roles, 'publish_pip')
}
```

Replace `NotificationTarget` and `targetFor`:

```ts
export type NotificationTarget = {
  to: string
  params?: { id: string }
  search?: { entrada?: string; publicacion?: string }
}

/**
 * Where opening a notification lands. A journal row is about an athlete:
 * the athlete goes to their own pages, staff to the athlete's. A PIP row is
 * about a post: a member goes to the feed, a lead to their screen.
 */
export function targetFor(n: {
  userId: string
  athleteId?: string
  kind: NotificationKind
  entryId?: string
  postId?: string
  /** The recipient holds `publish_pip`. Only read for PIP rows. */
  forLead?: boolean
}): NotificationTarget {
  if (n.kind === 'pip_post_published' || n.kind === 'pip_comment_reply' || n.kind === 'pip_comment_new') {
    const search = n.postId ? { publicacion: n.postId } : undefined
    return { to: n.forLead ? '/administracion/pip' : '/pip', search }
  }
  const isAthlete = n.userId === n.athleteId
  const search = n.entryId ? { entrada: n.entryId } : undefined
  if (isAthlete) {
    if (n.kind === 'assignment_created' || n.kind === 'assignment_ended') return { to: '/perfil' }
    return { to: '/bitacora', search }
  }
  return { to: '/administracion/atletas/$id', params: { id: n.athleteId ?? '' }, search }
}
```

- [ ] **Step 4: Teach `notify` and `describe` about posts**

In `convex/notifications.ts` replace `notify`:

```ts
export async function notify(
  ctx: MutationCtx,
  event: NotificationEvent,
  about: {
    athleteId?: Id<'users'>
    entryId?: Id<'journalEntries'>
    commentId?: Id<'journalComments'>
    postId?: Id<'pipPosts'>
  },
): Promise<void> {
  const now = Date.now()
  for (const r of recipientsFor(event)) {
    // "New comments" is one unread per lead per post: a second comment
    // before the first was read adds nothing.
    if (r.kind === 'pip_comment_new' && about.postId) {
      const unread = await ctx.db
        .query('notifications')
        .withIndex('by_user_unread', (q) => q.eq('userId', r.userId as Id<'users'>).eq('readAt', undefined))
        .collect()
      if (unread.some((n) => n.kind === 'pip_comment_new' && n.postId === about.postId)) continue
    }
    await ctx.db.insert('notifications', {
      userId: r.userId as Id<'users'>,
      kind: r.kind,
      actorId: event.actorId as Id<'users'>,
      athleteId: about.athleteId,
      entryId: about.entryId,
      commentId: about.commentId,
      postId: about.postId,
      createdAt: now,
    })
  }
}
```

Replace `describe` so it tolerates a missing athlete and resolves the post:

```ts
async function describe(ctx: QueryCtx, n: Doc<'notifications'>) {
  const [actor, athlete, entry, post, recipient] = await Promise.all([
    ctx.db.get(n.actorId),
    n.athleteId ? ctx.db.get(n.athleteId) : Promise.resolve(null),
    n.entryId ? ctx.db.get(n.entryId) : Promise.resolve(null),
    n.postId ? ctx.db.get(n.postId) : Promise.resolve(null),
    ctx.db.get(n.userId),
  ])
  return {
    _id: n._id,
    kind: n.kind,
    userId: n.userId,
    athleteId: n.athleteId,
    entryId: n.entryId,
    postId: n.postId,
    createdAt: n.createdAt,
    readAt: n.readAt,
    actorName: actor?.name ?? actor?.email ?? '',
    athleteName: athlete?.name ?? athlete?.email ?? '',
    entryTitle: entry?.title,
    postTitle: post?.title,
    forLead: recipient ? can(recipient.roles, 'publish_pip') : false,
  }
}
```

Add `import { can } from './lib/permissions'` at the top of `convex/notifications.ts`.

- [ ] **Step 5: The sentences**

In `src/components/Notifications/NotificationItem.tsx` widen the view and add the cases:

```ts
export type NotificationView = {
  _id: string
  kind: NotificationKind
  userId: string
  athleteId?: string
  entryId?: string
  postId?: string
  createdAt: number
  readAt?: number
  actorName: string
  athleteName: string
  entryTitle?: string
  postTitle?: string
  forLead?: boolean
}
```

In `sentenceFor`, before the `switch`, keep `title`; add `const post = n.postTitle ?? m.detail_empty()` and the cases:

```ts
    case 'pip_post_published':
      return m.notif_pip_post_published({ actor: n.actorName, title: post })
    case 'pip_comment_reply':
      return m.notif_pip_comment_reply({ actor: n.actorName, title: post })
    case 'pip_comment_new':
      return m.notif_pip_comment_new({ title: post })
```

Messages — `messages/es.json` after `"notif_assignment_ended_staff"`:

```json
  "notif_pip_post_published": "{actor} publicó “{title}” en el PIP",
  "notif_pip_comment_reply": "{actor} respondió a tu comentario en “{title}”",
  "notif_pip_comment_new": "Hay comentarios nuevos en “{title}”",
```

`messages/en.json`:

```json
  "notif_pip_post_published": "{actor} published “{title}” in the PIP",
  "notif_pip_comment_reply": "{actor} replied to your comment on “{title}”",
  "notif_pip_comment_new": "There are new comments on “{title}”",
```

Both `NotificationsMenu.tsx` and `notificaciones.tsx` already call `targetFor(n)` with the whole view and pass `t.search` through, so the `publicacion` param reaches the router untouched. `/pip` reads it in Task 11.

- [ ] **Step 6: Run everything**

Run: `pnpm check`
Expected: PASS — Tasks 7, 8 and 9 now typecheck together.

- [ ] **Step 7: Commit Tasks 6–9**

```bash
git add convex/schema.ts convex/pip.ts convex/lib/notificationRules.ts convex/notifications.ts src/components/Notifications/NotificationItem.tsx messages/es.json messages/en.json tests/notificationRules.test.ts
git commit -m "feat(pip): tables and functions — groups, posts on a schedule, comments, reactions, and three notifications

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: A removed member leaves every group

**Files:**
- Modify: `convex/registrations.ts:13` (import) and `:456` (the removal branch)

- [ ] **Step 1: Hook the removal**

Add the import:

```ts
import { endPipGroupsForAthlete } from './pip'
```

Directly after the line `await endAllAssignmentsForAthlete(ctx, r.userId, actor._id, now)`:

```ts
      // The PIP too: a removed member's group rows end in the same
      // mutation, so the feed empties the moment the decision lands.
      await endPipGroupsForAthlete(ctx, r.userId, now)
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

```bash
git add convex/registrations.ts
git commit -m "feat(pip): removal from the program ends every PIP group membership

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: The copy, the renderer, and the media tiles

**Files:**
- Modify: `package.json` (via `pnpm add react-markdown remark-gfm`)
- Modify: `messages/es.json`, `messages/en.json`
- Create: `src/components/Pip/Markdown.tsx`, `src/components/Pip/MediaGrid.tsx`
- Test: `tests/components/Markdown.test.tsx`, `tests/components/MediaGrid.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  <Markdown body={string} inlineOnly?={boolean} className?={string} />
  type AttachmentView = { type: 'image' | 'video'; url: string | null; name: string } | { type: 'youtube'; videoId: string; unavailable: boolean }
  <MediaGrid attachments={AttachmentView[]} />          // tiles + its own lightbox state
  attachmentTitle(a: AttachmentView): string
  attachmentSummary(list: AttachmentView[]): { glyph: string; text: string }[]
  ```
  `AttachmentView` is exported from `MediaGrid.tsx` and is exactly the shape `api.pip.feed` returns.

- [ ] **Step 1: Add the renderer's dependencies**

Run: `pnpm add react-markdown remark-gfm`
Expected: both land in `dependencies`. `react-markdown` renders no raw HTML unless a rehype plugin allows it, which is the sanitising the spec asks for; `remark-gfm` gives tables.

- [ ] **Step 2: Add the UI copy**

`messages/es.json` — a new block after the `journal_*` keys:

```json
  "nav_pip": "PIP",
  "pip_eyebrow": "Programa Integral de Performance",
  "pip_title": "PIP",
  "pip_intro": "Lo que la encargada publica para ti: qué ver, qué probar, cuándo verse. Lo que escribas debajo de una publicación lo lee solo ella, salvo que diga lo contrario.",
  "pip_month_label": "Mes",
  "pip_months_all": "Todos los meses",
  "pip_kind_all": "Todo",
  "pip_kind_content": "Contenido",
  "pip_kind_session": "Sesión en vivo",
  "pip_kind_challenge": "Reto",
  "pip_count_n": "{n}",
  "pip_edited": "editado",
  "pip_empty": "Todavía no hay publicaciones.",
  "pip_no_match": "Nada con ese filtro.",
  "pip_load_more": "Ver más",
  "pip_expand": "Abrir la publicación",
  "pip_collapse": "Cerrar la publicación",
  "pip_videos_one": "1 video",
  "pip_videos_n": "{n} videos",
  "pip_videos_unavailable": "({n} no disponible)",
  "pip_images_one": "1 imagen",
  "pip_images_n": "{n} imágenes",
  "pip_comments_none": "Sin comentarios",
  "pip_comments_one": "1 comentario",
  "pip_comments_n": "{n} comentarios",
  "pip_comments_lead_none": "Escríbele a la encargada",
  "pip_comments_lead_n": "Con la encargada · {n}",
  "pip_visibility_off": "La encargada desactivó los comentarios en esta publicación.",
  "pip_visibility_lead": "Lo que escribas aquí lo lee solo la encargada.",
  "pip_visibility_group": "Lo que escribas aquí lo lee tu grupo.",
  "pip_compose_lead": "Escríbele a la encargada. Nadie más lo lee.",
  "pip_compose_group": "Comenta con tu grupo.",
  "pip_comment_label": "Comentario",
  "pip_comment_send": "Comentar",
  "pip_reply": "Responder",
  "pip_reply_cancel": "Cancelar",
  "pip_reply_placeholder": "Tu respuesta",
  "pip_comment_hidden": "Tu comentario fue ocultado por la encargada.",
  "pip_lead_pill": "Encargada del PIP",
  "pip_inactive_member": "Ya no forma parte del programa",
  "pip_written_private": "escrito en privado",
  "pip_no_comments_lead": "Todavía no le has escrito nada sobre esto.",
  "pip_no_comments_group": "Nadie ha comentado todavía.",
  "pip_see_older": "Ver {n} comentarios anteriores",
  "pip_react": "Reaccionar",
  "pip_react_more": "Más reacciones",
  "pip_reaction_mine": "{emoji} {n}, tuya",
  "pip_reaction": "{emoji} {n}",
  "pip_recent_emoji": "Recientes",
  "pip_all_emoji": "Todas",
  "pip_only_lead_sees_who": "Solo la encargada ve quién reaccionó.",
  "pip_video_unavailable": "Video no disponible",
  "pip_video_unavailable_hint": "YouTube lo marcó privado o lo eliminó. La encargada ve este aviso.",
  "pip_file_missing": "Este archivo ya no está disponible.",
  "pip_zoom": "Sesión por Zoom",
  "pip_zoom_enter": "Entrar a Zoom",
  "pip_open_attachment": "Abrir: {title}",
  "pip_lightbox_of": "{i} de {n}",
  "pip_lightbox_prev": "Anterior",
  "pip_lightbox_next": "Siguiente",
  "pip_lightbox_close": "Cerrar",
  "pip_youtube": "YouTube",
  "pip_video": "Video",
```

`messages/en.json`, same keys:

```json
  "nav_pip": "PIP",
  "pip_eyebrow": "Integral Performance Program",
  "pip_title": "PIP",
  "pip_intro": "What the lead publishes for you: what to watch, what to try, when to meet. What you write under a post is read by her alone, unless it says otherwise.",
  "pip_month_label": "Month",
  "pip_months_all": "All months",
  "pip_kind_all": "All",
  "pip_kind_content": "Content",
  "pip_kind_session": "Live session",
  "pip_kind_challenge": "Challenge",
  "pip_count_n": "{n}",
  "pip_edited": "edited",
  "pip_empty": "Nothing published yet.",
  "pip_no_match": "Nothing matches that filter.",
  "pip_load_more": "Show more",
  "pip_expand": "Open the post",
  "pip_collapse": "Close the post",
  "pip_videos_one": "1 video",
  "pip_videos_n": "{n} videos",
  "pip_videos_unavailable": "({n} unavailable)",
  "pip_images_one": "1 image",
  "pip_images_n": "{n} images",
  "pip_comments_none": "No comments",
  "pip_comments_one": "1 comment",
  "pip_comments_n": "{n} comments",
  "pip_comments_lead_none": "Write to the lead",
  "pip_comments_lead_n": "With the lead · {n}",
  "pip_visibility_off": "The lead turned comments off on this post.",
  "pip_visibility_lead": "What you write here is read by the lead alone.",
  "pip_visibility_group": "What you write here is read by your group.",
  "pip_compose_lead": "Write to the lead. Nobody else reads it.",
  "pip_compose_group": "Comment with your group.",
  "pip_comment_label": "Comment",
  "pip_comment_send": "Comment",
  "pip_reply": "Reply",
  "pip_reply_cancel": "Cancel",
  "pip_reply_placeholder": "Your reply",
  "pip_comment_hidden": "The lead hid your comment.",
  "pip_lead_pill": "PIP lead",
  "pip_inactive_member": "No longer in the program",
  "pip_written_private": "written in private",
  "pip_no_comments_lead": "You haven't written to her about this yet.",
  "pip_no_comments_group": "Nobody has commented yet.",
  "pip_see_older": "Show {n} earlier comments",
  "pip_react": "React",
  "pip_react_more": "More reactions",
  "pip_reaction_mine": "{emoji} {n}, yours",
  "pip_reaction": "{emoji} {n}",
  "pip_recent_emoji": "Recent",
  "pip_all_emoji": "All",
  "pip_only_lead_sees_who": "Only the lead sees who reacted.",
  "pip_video_unavailable": "Video unavailable",
  "pip_video_unavailable_hint": "YouTube made it private or removed it. The lead sees this notice too.",
  "pip_file_missing": "This file is no longer available.",
  "pip_zoom": "Zoom session",
  "pip_zoom_enter": "Join on Zoom",
  "pip_open_attachment": "Open: {title}",
  "pip_lightbox_of": "{i} of {n}",
  "pip_lightbox_prev": "Previous",
  "pip_lightbox_next": "Next",
  "pip_lightbox_close": "Close",
  "pip_youtube": "YouTube",
  "pip_video": "Video",
```

Run `pnpm paraglide` so `m.pip_*` exist.

- [ ] **Step 3: Write the failing renderer test**

`tests/components/Markdown.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Markdown from '../../src/components/Pip/Markdown'

describe('Markdown', () => {
  it('renders the allowed subset: headings, emphasis, lists, quotes, links, tables', () => {
    render(
      <Markdown
        body={'## Este mes\n\nQué **hacemos** con el *error*.\n\n- uno\n- dos\n\n> Una cita\n\n[Bases](https://example.com)\n\n| a | b |\n| - | - |\n| 1 | 2 |'}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Este mes' })).toBeInTheDocument()
    expect(screen.getByText('hacemos').tagName).toBe('STRONG')
    expect(screen.getByText('error').tagName).toBe('EM')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Una cita').closest('blockquote')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Bases' })).toHaveAttribute('href', 'https://example.com')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('renders raw HTML as text, never as markup', () => {
    render(<Markdown body={'Hola <script>alert(1)</script> <b>no</b>'} />)
    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('b')).toBeNull()
    expect(screen.getByText(/alert\(1\)/)).toBeInTheDocument()
  })

  it('opens links in a new tab with no opener', () => {
    render(<Markdown body={'[x](https://example.com)'} />)
    const a = screen.getByRole('link', { name: 'x' })
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noreferrer')
  })

  it('drops headings and tables in inline-only mode, keeping emphasis and links', () => {
    render(<Markdown body={'## Título\n\n**fuerte** y [liga](https://example.com)\n\n| a |\n| - |\n| 1 |'} inlineOnly />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Título')).toBeInTheDocument()
    expect(screen.getByText('fuerte').tagName).toBe('STRONG')
  })
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm vitest run tests/components/Markdown.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 5: Write the renderer**

`src/components/Pip/Markdown.tsx`:

```tsx
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  body: string
  /** Comments: emphasis, links and lists only. A heading inside a thread is a layout bug waiting to happen. */
  inlineOnly?: boolean
  className?: string
}

/**
 * The one markdown renderer, for posts, comments and — once the editor
 * lands — the bitácora. `react-markdown` renders no raw HTML unless told
 * to, which is the sanitising the spec asks for: a pasted `<script>` is
 * text. The subset is the spec's §7; anything wider needs a reason.
 */
const BLOCK: Components = {
  h1: ({ children }) => <h2 className="mt-5 font-disp text-[19px] font-bold first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-5 font-disp text-[19px] font-bold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-4 font-disp text-[16px] font-bold">{children}</h3>,
  h4: ({ children }) => <h3 className="mt-4 font-disp text-[16px] font-bold">{children}</h3>,
  h5: ({ children }) => <h3 className="mt-4 font-disp text-[16px] font-bold">{children}</h3>,
  h6: ({ children }) => <h3 className="mt-4 font-disp text-[16px] font-bold">{children}</h3>,
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-3 grid list-disc gap-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 grid list-decimal gap-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-yel-line pl-4 font-light text-ink-3 italic">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="break-words underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line-2 px-2 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-2 py-1.5 align-top">{children}</td>,
  img: () => null,
  hr: () => null,
  code: ({ children }) => <span>{children}</span>,
  pre: ({ children }) => <p className="my-3">{children}</p>,
}

const INLINE: Components = {
  ...BLOCK,
  h1: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h2: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h3: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h4: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h5: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h6: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  table: () => null,
  blockquote: ({ children }) => <div className="my-2">{children}</div>,
}

export default function Markdown({ body, inlineOnly = false, className = '' }: Props) {
  return (
    <div className={`text-[14.5px] leading-relaxed font-light ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={inlineOnly ? INLINE : BLOCK} skipHtml={false}>
        {body}
      </ReactMarkdown>
    </div>
  )
}
```

`skipHtml={false}` keeps raw HTML as visible text (react-markdown escapes it); `skipHtml` would drop it silently, and a member should see that their angle brackets survived rather than vanished.

- [ ] **Step 6: Run the renderer test**

Run: `pnpm vitest run tests/components/Markdown.test.tsx`
Expected: PASS. If `getByText(/alert\(1\)/)` fails because react-markdown splits the text across nodes, change the assertion to `expect(document.body.textContent).toContain('alert(1)')`.

- [ ] **Step 7: Write the failing media test**

`tests/components/MediaGrid.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import MediaGrid, { attachmentSummary, type AttachmentView } from '../../src/components/Pip/MediaGrid'

const three: AttachmentView[] = [
  { type: 'youtube', videoId: 'dQw4w9WgXcQ', unavailable: false },
  { type: 'youtube', videoId: 'xxxxxxxxxxx', unavailable: true },
  { type: 'image', url: 'https://files.example/hoja.png', name: 'Hoja de trabajo' },
]

describe('attachmentSummary', () => {
  it('counts videos and images, and says how many videos are gone', () => {
    expect(attachmentSummary(three)).toEqual([
      { glyph: '▶', text: `${m.pip_videos_n({ n: 2 })} ${m.pip_videos_unavailable({ n: 1 })}` },
      { glyph: '▣', text: m.pip_images_one() },
    ])
    expect(attachmentSummary([])).toEqual([])
  })
})

describe('MediaGrid', () => {
  it('draws one tile per attachment, the unavailable one as an error', () => {
    render(<MediaGrid attachments={three} />)
    expect(screen.getAllByRole('button', { name: /Abrir:|Open:/ })).toHaveLength(3)
    expect(screen.getByText(m.pip_video_unavailable())).toBeInTheDocument()
    expect(screen.getByAltText('Hoja de trabajo')).toHaveAttribute('src', 'https://files.example/hoja.png')
  })

  it('opens the lightbox on the tile pressed and moves with the arrows', () => {
    render(<MediaGrid attachments={three} />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_open_attachment({ title: 'Hoja de trabajo' }) }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByText(m.pip_lightbox_of({ i: 3, n: 3 }))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.pip_lightbox_prev() }))
    expect(screen.getByText(m.pip_lightbox_of({ i: 2, n: 3 }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.pip_lightbox_next() })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.pip_lightbox_close() }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('embeds a YouTube video in the lightbox and a stored video with a player', () => {
    render(<MediaGrid attachments={[three[0], { type: 'video', url: 'https://files.example/v.mp4', name: 'Renata se presenta' }]} />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_open_attachment({ title: 'Renata se presenta' }) }))
    expect(document.querySelector('video')?.getAttribute('src')).toBe('https://files.example/v.mp4')
    fireEvent.click(screen.getByRole('button', { name: m.pip_lightbox_prev() }))
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('says a stored file is missing when its url is null', () => {
    render(<MediaGrid attachments={[{ type: 'image', url: null, name: 'Calendario' }]} />)
    expect(screen.getByText(m.pip_file_missing())).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Run to verify it fails**

Run: `pnpm vitest run tests/components/MediaGrid.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 9: Write the tiles and the lightbox**

`src/components/Pip/MediaGrid.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as m from '../../paraglide/messages.js'

/** Exactly what `api.pip.feed` returns per attachment. */
export type AttachmentView =
  | { type: 'image' | 'video'; url: string | null; name: string }
  | { type: 'youtube'; videoId: string; unavailable: boolean }

export function attachmentTitle(a: AttachmentView): string {
  return a.type === 'youtube' ? `YouTube · ${a.videoId}` : a.name
}

/** "2 videos (1 no disponible) · 1 imagen", for a collapsed row. */
export function attachmentSummary(list: AttachmentView[]): { glyph: string; text: string }[] {
  const videos = list.filter((a) => a.type !== 'image')
  const images = list.filter((a) => a.type === 'image')
  const broken = list.filter((a) => (a.type === 'youtube' && a.unavailable) || (a.type === 'video' && a.url === null)).length
  const out: { glyph: string; text: string }[] = []
  if (videos.length) {
    const n = videos.length === 1 ? m.pip_videos_one() : m.pip_videos_n({ n: videos.length })
    out.push({ glyph: '▶', text: broken ? `${n} ${m.pip_videos_unavailable({ n: broken })}` : n })
  }
  if (images.length) out.push({ glyph: '▣', text: images.length === 1 ? m.pip_images_one() : m.pip_images_n({ n: images.length }) })
  return out
}

const isBroken = (a: AttachmentView) => (a.type === 'youtube' ? a.unavailable : a.url === null)

/**
 * One attachment as a 16:9 tile with a caption under it. Every type is the
 * same box — an image is cropped to it, the error card fills it — so a row
 * of three lines up whatever they are. The tile is a button that opens the
 * lightbox.
 */
function Tile({ a, onOpen, strip = false }: { a: AttachmentView; onOpen: () => void; strip?: boolean }) {
  const box = strip ? 'w-[78%] flex-none snap-start sm:w-[340px]' : 'w-full'
  const tile =
    'relative block aspect-video w-full cursor-zoom-in overflow-hidden rounded-[9px] text-left focus-visible:shadow-[0_0_0_3px_var(--color-yel-ring)] focus-visible:outline-none'
  const title = attachmentTitle(a)
  let face: ReactNode
  let caption: ReactNode = title
  if (isBroken(a)) {
    face = (
      <span className="grid h-full content-center border border-bad-line bg-bad-wash px-4 py-3">
        <b className="block text-[13px] leading-tight font-semibold text-bad">{a.type === 'youtube' ? m.pip_video_unavailable() : m.pip_file_missing()}</b>
        {a.type === 'youtube' && <span className="mt-1 line-clamp-2 block text-[11.5px] leading-snug text-ink-3">{m.pip_video_unavailable_hint()}</span>}
      </span>
    )
    caption = <span className="text-soft line-through">{title}</span>
  } else if (a.type === 'image') {
    face = <img src={a.url ?? undefined} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
  } else {
    face = (
      <span className="grid h-full place-items-center bg-ink text-paper">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-yel text-[22px] text-on-yel">▶</span>
        <span className="absolute top-2.5 left-3 rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] tracking-[.08em] uppercase">
          {a.type === 'youtube' ? m.pip_youtube() : m.pip_video()}
        </span>
      </span>
    )
  }
  return (
    <figure className={`${box} m-0`}>
      <button type="button" className={`${tile} border border-line`} onClick={onOpen} aria-label={m.pip_open_attachment({ title })}>
        {face}
      </button>
      <figcaption className="mt-1.5 line-clamp-1 text-[13px] font-medium">{caption}</figcaption>
    </figure>
  )
}

/** The attachment, large, with the real player or embed. */
function Large({ a }: { a: AttachmentView }) {
  if (isBroken(a)) {
    return (
      <div className="grid h-full content-center justify-items-center gap-2 px-6 text-center">
        <b className="text-[17px] font-semibold text-bad">{a.type === 'youtube' ? m.pip_video_unavailable() : m.pip_file_missing()}</b>
        {a.type === 'youtube' && <span className="max-w-[48ch] text-[13.5px] text-paper/70">{m.pip_video_unavailable_hint()}</span>}
      </div>
    )
  }
  if (a.type === 'image') return <img src={a.url ?? undefined} alt={a.name} className="h-full w-full object-contain" />
  if (a.type === 'video') return <video src={a.url ?? undefined} controls className="h-full w-full" />
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${a.videoId}`}
      title={attachmentTitle(a)}
      className="h-full w-full"
      allow="accelerometer; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  )
}

/**
 * A native dialog — the element the journal's entry dialog uses, so Escape
 * and the backdrop behave as the app's dialogs do. Arrows move between the
 * post's attachments; the strip under the stage jumps.
 */
function Lightbox({ attachments, index, onClose, onMove }: { attachments: AttachmentView[]; index: number; onClose: () => void; onMove: (i: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const a = attachments[index]
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowLeft' && index > 0) onMove(index - 1)
      if (ev.key === 'ArrowRight' && index < attachments.length - 1) onMove(index + 1)
    }
    d.addEventListener('keydown', onKey)
    return () => d.removeEventListener('keydown', onKey)
  }, [index, attachments.length, onMove])
  if (!a) return null
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="m-auto w-[min(96vw,1100px)] rounded-[12px] border border-line bg-card p-0 text-ink shadow-[0_24px_64px_rgba(0,0,0,.5)] backdrop:bg-black/80"
    >
      <div className="grid gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">{m.pip_lightbox_of({ i: index + 1, n: attachments.length })}</span>
          <b className="min-w-0 flex-1 truncate text-[14px] font-semibold">{attachmentTitle(a)}</b>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label={m.pip_lightbox_close()}>✕</button>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-[9px] bg-ink">
          <Large a={a} />
          {index > 0 && (
            <button type="button" className="absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-paper hover:bg-black/70" onClick={() => onMove(index - 1)} aria-label={m.pip_lightbox_prev()}>←</button>
          )}
          {index < attachments.length - 1 && (
            <button type="button" className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-paper hover:bg-black/70" onClick={() => onMove(index + 1)} aria-label={m.pip_lightbox_next()}>→</button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {attachments.map((x, i) => (
            <button
              key={i}
              type="button"
              className={`aspect-video w-[88px] flex-none overflow-hidden rounded-[6px] border-2 ${i === index ? 'border-yel' : 'border-transparent opacity-60 hover:opacity-100'}`}
              onClick={() => onMove(i)}
              aria-label={attachmentTitle(x)}
              aria-current={i === index}
            >
              {x.type === 'image' && x.url ? (
                <img src={x.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className={`grid h-full w-full place-items-center text-[12px] ${isBroken(x) ? 'bg-bad-wash text-bad' : 'bg-ink text-paper'}`}>{isBroken(x) ? '!' : '▶'}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  )
}

/**
 * The attachments of one post. One is full width; two sit side by side;
 * three or more make a grid on a laptop and a swipeable strip on a phone,
 * where a grid of thirds would shrink a video to a thumbnail. Owns the
 * lightbox.
 */
export default function MediaGrid({ attachments }: { attachments: AttachmentView[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const n = attachments.length
  if (n === 0) return null
  const tiles = (strip: boolean) => attachments.map((a, i) => <Tile key={i} a={a} strip={strip} onOpen={() => setOpen(i)} />)
  return (
    <>
      {n === 1 && tiles(false)}
      {n === 2 && <div className="grid gap-4 sm:grid-cols-2">{tiles(false)}</div>}
      {n >= 3 && (
        <>
          <div className="-mx-[18px] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[18px] pb-1 md:hidden">{tiles(true)}</div>
          <div className="hidden gap-4 md:grid md:grid-cols-3">{tiles(false)}</div>
        </>
      )}
      {open !== null && <Lightbox attachments={attachments} index={open} onClose={() => setOpen(null)} onMove={setOpen} />}
    </>
  )
}
```

Note for the test: with three attachments both the strip and the grid are in the DOM (one hidden by CSS), so `getAllByRole('button', { name: /Abrir:|Open:/ })` returns 6, not 3. Change that assertion to `toHaveLength(6)` and add a comment saying why, or render two attachments in that test. Prefer the second: use `three.slice(0, 2)` plus the image, which is still three… so use `toHaveLength(6)` with the comment.

- [ ] **Step 10: Run the media tests**

Run: `pnpm vitest run tests/components/MediaGrid.test.tsx`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml messages/es.json messages/en.json src/components/Pip/Markdown.tsx src/components/Pip/MediaGrid.tsx tests/components/Markdown.test.tsx tests/components/MediaGrid.test.tsx
git commit -m "feat(pip): the copy, a markdown renderer that treats HTML as text, and uniform media tiles with a lightbox

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Reactions, the thread, and the post card

**Files:**
- Create: `src/components/Pip/ReactionRow.tsx`, `src/components/Pip/PostThread.tsx`, `src/components/Pip/PostCard.tsx`
- Test: `tests/components/ReactionRow.test.tsx`, `tests/components/PostThread.test.tsx`, `tests/components/PostCard.test.tsx`

**Interfaces:**
- Consumes: `api.pip.react`, `api.pip.comments`, `api.pip.addComment`, `api.pip.deleteComment` (Task 8); `Markdown`, `MediaGrid`, `attachmentSummary`, `AttachmentView` (Task 11); `zoomLinkIn` (Task 4); `Pill` (`src/components/Pill.tsx`); `useDateFormats` (`src/components/DateField/format.ts`).
- Produces:
  ```ts
  type Reaction = { emoji: string; count: number; mine: boolean }
  <ReactionRow targetKind="post" | "comment" targetId={string} reactions={Reaction[]} />
  <PostThread postId={string} commentsVisibility="lead" | "group" />
  type PostView = { _id: string; kind: 'content' | 'session' | 'challenge'; title: string; body: string; authorName: string; publishedAt: number; editedAt?: number; commentsVisibility: 'off' | 'lead' | 'group'; attachments: AttachmentView[]; reactions: Reaction[]; commentCount: number }
  <PostCard post={PostView} open={boolean} onToggle={() => void} />
  ```

- [ ] **Step 1: Write the failing reaction test**

`tests/components/ReactionRow.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

const react = vi.fn(async () => ({ on: true }))

vi.mock('convex/react', () => ({
  useMutation: () => react,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { pip: { react: 'pip:react' } },
}))

const { default: ReactionRow, QUICK_EMOJI, recentEmoji, rememberEmoji } = await import('../../src/components/Pip/ReactionRow')

beforeEach(() => {
  react.mockClear()
  window.localStorage.clear()
})

describe('ReactionRow', () => {
  it('draws each reaction as a pressed or unpressed chip with its count', () => {
    render(<ReactionRow targetKind="post" targetId="p1" reactions={[{ emoji: '🔥', count: 7, mine: true }, { emoji: '💪', count: 4, mine: false }]} />)
    expect(screen.getByRole('button', { name: m.pip_reaction_mine({ emoji: '🔥', n: 7 }) })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: m.pip_reaction({ emoji: '💪', n: 4 }) })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles a chip through the mutation', () => {
    render(<ReactionRow targetKind="post" targetId="p1" reactions={[{ emoji: '🔥', count: 7, mine: true }]} />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_reaction_mine({ emoji: '🔥', n: 7 }) }))
    expect(react).toHaveBeenCalledWith({ targetKind: 'post', targetId: 'p1', emoji: '🔥' })
  })

  it('opens a picker with recents first and every emoji behind it, and remembers what was picked', () => {
    render(<ReactionRow targetKind="comment" targetId="c1" reactions={[]} />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_react() }))
    expect(screen.getByText(m.pip_recent_emoji())).toBeInTheDocument()
    expect(screen.getByText(m.pip_only_lead_sees_who())).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '🧠' }))
    expect(react).toHaveBeenCalledWith({ targetKind: 'comment', targetId: 'c1', emoji: '🧠' })
    expect(recentEmoji()[0]).toBe('🧠')
    expect(screen.queryByText(m.pip_recent_emoji())).toBeNull()
  })

  it('keeps five recents, newest first, seeded from the quick row', () => {
    expect(recentEmoji()).toEqual(QUICK_EMOJI)
    rememberEmoji('🎯')
    rememberEmoji('🧠')
    rememberEmoji('🎯')
    expect(recentEmoji()).toEqual(['🎯', '🧠', ...QUICK_EMOJI].slice(0, 5))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/components/ReactionRow.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the row**

`src/components/Pip/ReactionRow.tsx`:

```tsx
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'

export type Reaction = { emoji: string; count: number; mine: boolean }

/** The quick row before anyone has picked anything. */
export const QUICK_EMOJI = ['👍', '❤️', '💡', '🔥', '🙌'] as const

/** The library behind the plus. A curated set, not the whole of Unicode: the picker is one row of buttons, not a search engine. */
export const ALL_EMOJI = [
  '👍', '❤️', '💡', '🔥', '🙌', '😂', '😮', '😢', '👏', '🎯', '⛳', '💪', '🧠', '🌱', '✨', '🤝',
  '👀', '🫶', '😤', '🥲', '🙏', '🏌️', '🏆', '🌤️', '😴', '🫡', '🤯', '😌', '🥹', '💯', '🎉', '🍀',
  '📝', '⏱️', '🧘', '🤞', '😅', '🙂', '😍', '🤩', '😎', '🥳', '😇', '🤔', '😬', '🫠', '🤗', '👊',
] as const

const RECENT_KEY = 'pip.recentEmoji'
const RECENT_LIMIT = 5

/** Most recently used first, per device. The quick row fills the rest. Never throws: storage may be absent. */
export function recentEmoji(): string[] {
  let stored: string[] = []
  try {
    stored = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    stored = []
  }
  const out: string[] = []
  for (const e of [...stored, ...QUICK_EMOJI]) if (!out.includes(e)) out.push(e)
  return out.slice(0, RECENT_LIMIT)
}

export function rememberEmoji(emoji: string): void {
  const next = [emoji, ...recentEmoji().filter((e) => e !== emoji)].slice(0, RECENT_LIMIT)
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // A private window or blocked storage: the row just does not learn.
  }
}

type Props = {
  targetKind: 'post' | 'comment'
  targetId: string
  reactions: Reaction[]
}

/**
 * The reactions under a post or a top-level comment, and the way to add
 * one. Any emoji, several per member. Counts are everyone's; who reacted
 * is the lead's, which the picker says so nobody wonders.
 */
export default function ReactionRow({ targetKind, targetId, reactions }: Props) {
  const react = useMutation(api.pip.react)
  const [open, setOpen] = useState(false)
  const send = (emoji: string) => {
    void react({ targetKind, targetId: targetId as Id<'pipPosts'> | Id<'pipComments'>, emoji })
  }
  const pick = (emoji: string) => {
    rememberEmoji(emoji)
    send(emoji)
    setOpen(false)
  }
  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className="chip chip-toggle inline-flex items-center gap-1.5 tabular-nums"
          aria-pressed={r.mine}
          aria-label={r.mine ? m.pip_reaction_mine({ emoji: r.emoji, n: r.count }) : m.pip_reaction({ emoji: r.emoji, n: r.count })}
          onClick={() => send(r.emoji)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          {r.count}
        </button>
      ))}
      <button
        type="button"
        className="chip chip-more"
        aria-expanded={open}
        aria-label={reactions.length === 0 ? m.pip_react() : m.pip_react_more()}
        onClick={() => setOpen((o) => !o)}
      >
        {reactions.length === 0 ? `☺ ${m.pip_react()}` : '+'}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-2 w-[344px] max-w-[calc(100vw-44px)] rounded-[9px] border border-line bg-card p-3 shadow-[0_12px_32px_rgba(0,0,0,.18)]">
          <p className="mb-1.5 font-mono text-[10px] tracking-[.1em] uppercase text-soft">{m.pip_recent_emoji()}</p>
          <div className="flex gap-0.5">
            {recentEmoji().map((e) => (
              <button key={e} type="button" className="grid size-10 place-items-center rounded-[7px] text-[22px] hover:bg-wash" onClick={() => pick(e)} aria-label={e}>{e}</button>
            ))}
          </div>
          <p className="mt-3 mb-1.5 font-mono text-[10px] tracking-[.1em] uppercase text-soft">{m.pip_all_emoji()}</p>
          <div className="grid max-h-[176px] grid-cols-8 gap-0.5 overflow-y-auto">
            {ALL_EMOJI.map((e) => (
              <button key={e} type="button" className="grid size-10 place-items-center rounded-[7px] text-[22px] hover:bg-wash" onClick={() => pick(e)} aria-label={e}>{e}</button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-soft">{m.pip_only_lead_sees_who()}</p>
        </div>
      )}
    </div>
  )
}
```

The test's `getByRole('button', { name: '🧠' })` finds two buttons if 🧠 is in both the recent row and the library; it is not in `QUICK_EMOJI`, so on a fresh store only the library has it. Keep 🧠 out of `QUICK_EMOJI`.

- [ ] **Step 4: Run the reaction test**

Run: `pnpm vitest run tests/components/ReactionRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing thread test**

`tests/components/PostThread.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

let thread: unknown
const add = vi.fn(async () => ({ id: 'c9' }))
const remove = vi.fn(async () => ({ ok: true }))
const react = vi.fn(async () => ({ on: true }))

vi.mock('convex/react', () => ({
  useQuery: () => thread,
  useMutation: (fn: string) => (fn === 'pip:addComment' ? add : fn === 'pip:deleteComment' ? remove : react),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { pip: { comments: 'pip:comments', addComment: 'pip:addComment', deleteComment: 'pip:deleteComment', react: 'pip:react' } },
}))

const { default: PostThread } = await import('../../src/components/Pip/PostThread')

const comment = (over: Record<string, unknown>) => ({
  _id: 'c1',
  authorName: 'Marcelo Treviño',
  isLead: false,
  isMine: false,
  inactive: false,
  body: 'Acepto. El driver es donde más me acelero.',
  createdAt: 0,
  visibility: 'group',
  hidden: false,
  reactions: [],
  replies: [],
  ...over,
})

beforeEach(() => {
  add.mockClear()
  remove.mockClear()
})

describe('PostThread', () => {
  it('says what the thread is for and who reads it, and offers the composer when allowed', () => {
    thread = { canComment: true, comments: [] }
    render(<PostThread postId="p1" commentsVisibility="lead" />)
    expect(screen.getByText(m.pip_visibility_lead())).toBeInTheDocument()
    expect(screen.getByPlaceholderText(m.pip_compose_lead())).toBeInTheDocument()
    expect(screen.getByText(m.pip_no_comments_lead())).toBeInTheDocument()
  })

  it('shows no composer when the server says the reader may not write', () => {
    thread = { canComment: false, comments: [comment({})] }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Acepto. El driver es donde más me acelero.')).toBeInTheDocument()
  })

  it('draws the lead\'s pill, the inactive dot, the hidden mark, and the private mark', () => {
    thread = {
      canComment: true,
      comments: [
        comment({ replies: [comment({ _id: 'r1', authorName: 'Mtra. Renata Fuentes', isLead: true, body: 'Perfecto.' })] }),
        comment({ _id: 'c2', authorName: 'Sofía Lozano', inactive: true, body: 'Yo lo hice en el Regional.' }),
        comment({ _id: 'c3', isMine: true, hidden: true, body: 'Retirado.' }),
        comment({ _id: 'c4', isMine: true, visibility: 'lead', body: 'En privado.' }),
      ],
    }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    expect(screen.getByText(m.pip_lead_pill())).toBeInTheDocument()
    expect(screen.getByText(m.pip_inactive_member())).toBeInTheDocument()
    expect(screen.getByText(m.pip_comment_hidden())).toBeInTheDocument()
    expect(screen.queryByText('Retirado.')).toBeNull()
    expect(screen.getByText(`· ${m.pip_written_private()}`)).toBeInTheDocument()
  })

  it('sends a comment, and a reply under its parent', async () => {
    thread = { canComment: true, comments: [comment({})] }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    fireEvent.change(screen.getByPlaceholderText(m.pip_compose_group()), { target: { value: 'Semana hecha.' } })
    fireEvent.click(screen.getByRole('button', { name: m.pip_comment_send() }))
    await waitFor(() => expect(add).toHaveBeenCalledWith({ postId: 'p1', body: 'Semana hecha.' }))

    fireEvent.click(screen.getByRole('button', { name: m.pip_reply() }))
    fireEvent.change(screen.getByPlaceholderText(m.pip_reply_placeholder()), { target: { value: 'Yo también.' } })
    fireEvent.click(screen.getAllByRole('button', { name: m.pip_comment_send() })[0])
    await waitFor(() => expect(add).toHaveBeenCalledWith({ postId: 'p1', body: 'Yo también.', parentId: 'c1' }))
  })

  it('keeps one reply box open at a time', () => {
    thread = { canComment: true, comments: [comment({}), comment({ _id: 'c2', body: 'Otro.' })] }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    const replies = screen.getAllByRole('button', { name: m.pip_reply() })
    fireEvent.click(replies[0])
    fireEvent.click(replies[1])
    expect(screen.getAllByPlaceholderText(m.pip_reply_placeholder())).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: m.pip_reply_cancel() })).toHaveLength(1)
  })

  it('offers delete only on the reader\'s own comments without replies or reactions', () => {
    thread = {
      canComment: true,
      comments: [
        comment({ isMine: true }),
        comment({ _id: 'c2', isMine: true, replies: [comment({ _id: 'r' })] }),
        comment({ _id: 'c3', isMine: true, reactions: [{ emoji: '🔥', count: 1, mine: false }] }),
        comment({ _id: 'c4' }),
      ],
    }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    expect(screen.getAllByRole('button', { name: m.common_delete() })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: m.common_delete() }))
    expect(remove).toHaveBeenCalledWith({ id: 'c1' })
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm vitest run tests/components/PostThread.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 7: Write the thread**

`src/components/Pip/PostThread.tsx`:

```tsx
import { useMutation, useQuery } from 'convex/react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'
import { PIP_COMMENT_LIMIT, validatePipComment } from '../../../convex/lib/pipRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'
import Pill from '../Pill'
import { useDateFormats } from '../DateField/format'
import Markdown from './Markdown'
import ReactionRow, { type Reaction } from './ReactionRow'

export type CommentView = {
  _id: string
  authorName: string
  isLead: boolean
  isMine: boolean
  inactive: boolean
  body: string
  createdAt: number
  visibility: 'lead' | 'group'
  hidden: boolean
  reactions: Reaction[]
  replies: CommentView[]
}

type Props = {
  postId: string
  commentsVisibility: 'lead' | 'group'
}

function Composer({ placeholder, onSend, small = false }: { placeholder: string; onSend: (body: string) => Promise<void>; small?: boolean }) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const boxId = useId()
  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const problem = validatePipComment(body)
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSend(body.trim())
      setBody('')
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className={small ? 'flex items-end gap-2' : 'grid gap-1.5'}>
      <label htmlFor={boxId} className="sr-only">{m.pip_comment_label()}</label>
      <textarea
        id={boxId}
        className={`fld-input resize-y ${small ? 'min-h-[42px] flex-1' : 'min-h-[72px]'}`}
        value={body}
        maxLength={PIP_COMMENT_LIMIT}
        placeholder={placeholder}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
          {busy ? m.common_loading() : m.pip_comment_send()}
        </button>
        {error && <span className="text-[11.5px] text-bad">{error}</span>}
      </div>
    </form>
  )
}

function Author({ c }: { c: CommentView }) {
  return (
    <span className="group/author relative inline-flex items-center gap-1.5">
      <b className={`text-[13px] font-semibold ${c.inactive ? 'text-soft' : ''}`}>{c.authorName}</b>
      {c.isLead && <Pill tone="brand">{m.pip_lead_pill()}</Pill>}
      {c.inactive && (
        <>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-faint" />
          {/* Hover on a laptop, long press on a phone (the browser's own on a touch-held element). */}
          <span
            role="tooltip"
            className="pointer-events-none absolute top-full left-0 z-10 mt-1 rounded-[7px] border border-line bg-card px-2 py-1 font-mono text-[10.5px] whitespace-nowrap text-soft opacity-0 shadow group-hover/author:opacity-100 group-focus-within/author:opacity-100"
          >
            {m.pip_inactive_member()}
          </span>
        </>
      )}
    </span>
  )
}

type CommentProps = {
  c: CommentView
  postId: string
  postVisibility: 'lead' | 'group'
  depth: number
  canComment: boolean
  replyingTo: string | null
  setReplyingTo: (id: string | null) => void
  onSend: (body: string, parentId?: string) => Promise<void>
  onDelete: (id: string) => void
}

function Comment({ c, postId, postVisibility, depth, canComment, replyingTo, setReplyingTo, onSend, onDelete }: CommentProps) {
  const fmt = useDateFormats()
  if (c.hidden) {
    return (
      <div className="rounded-[9px] border border-dashed border-line-2 px-3 py-2 text-[12.5px] text-soft">
        <Author c={c} /> · <span className="italic">{m.pip_comment_hidden()}</span>
      </div>
    )
  }
  const replying = replyingTo === c._id
  const deletable = c.isMine && c.replies.length === 0 && c.reactions.length === 0
  return (
    <div className={depth ? 'ml-6 border-l border-line pl-4' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        <Author c={c} />
        <span className="font-mono text-[10.5px] text-soft">{fmt.full.format(new Date(c.createdAt))}</span>
        {c.visibility === 'lead' && postVisibility === 'group' && (
          <span className="font-mono text-[10px] tracking-[.08em] uppercase text-soft">· {m.pip_written_private()}</span>
        )}
      </div>
      <Markdown body={c.body} inlineOnly className="mt-1" />
      {depth === 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ReactionRow targetKind="comment" targetId={c._id} reactions={c.reactions} />
          {canComment && (
            <button type="button" className="font-mono text-[11px] tracking-[.06em] text-soft underline" onClick={() => setReplyingTo(replying ? null : c._id)}>
              {replying ? m.pip_reply_cancel() : m.pip_reply()}
            </button>
          )}
          {deletable && (
            <button type="button" className="font-mono text-[11px] tracking-[.06em] text-soft underline hover:text-bad" onClick={() => onDelete(c._id)}>
              {m.common_delete()}
            </button>
          )}
        </div>
      )}
      {depth > 0 && deletable && (
        <button type="button" className="mt-1 font-mono text-[11px] tracking-[.06em] text-soft underline hover:text-bad" onClick={() => onDelete(c._id)}>
          {m.common_delete()}
        </button>
      )}
      {replying && (
        <div className="mt-2">
          <Composer small placeholder={m.pip_reply_placeholder()} onSend={async (b) => { await onSend(b, c._id); setReplyingTo(null) }} />
        </div>
      )}
      {c.replies.length > 0 && (
        <div className="mt-3 grid gap-3">
          {c.replies.map((r) => (
            <Comment key={r._id} c={r} postId={postId} postVisibility={postVisibility} depth={depth + 1} canComment={canComment} replyingTo={replyingTo} setReplyingTo={setReplyingTo} onSend={onSend} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A post's thread: who reads it, the box to add to it, the comments with
 * their replies. One reply box open at a time — opening another closes
 * the first. The server decides `canComment`; the box appears only where
 * a comment would be accepted.
 */
export default function PostThread({ postId, commentsVisibility }: Props) {
  const thread = useQuery(api.pip.comments, { postId: postId as Id<'pipPosts'> })
  const add = useMutation(api.pip.addComment)
  const remove = useMutation(api.pip.deleteComment)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const send = async (body: string, parentId?: string) => {
    await add(parentId ? { postId: postId as Id<'pipPosts'>, body, parentId: parentId as Id<'pipComments'> } : { postId: postId as Id<'pipPosts'>, body })
  }
  const del = (id: string) => void remove({ id: id as Id<'pipComments'> })

  if (thread === undefined) return <p className="text-[12.5px] text-soft">{m.common_loading()}</p>
  const note = commentsVisibility === 'lead' ? m.pip_visibility_lead() : m.pip_visibility_group()
  const placeholder = commentsVisibility === 'lead' ? m.pip_compose_lead() : m.pip_compose_group()
  return (
    <div className="grid gap-4">
      <p className="text-[12px] font-light text-soft">{note}</p>
      {thread.canComment && <Composer placeholder={placeholder} onSend={(b) => send(b)} />}
      {thread.comments.length === 0 && (
        <p className="text-[12.5px] text-soft">{commentsVisibility === 'lead' ? m.pip_no_comments_lead() : m.pip_no_comments_group()}</p>
      )}
      {thread.comments.map((c) => (
        <Comment key={c._id} c={c} postId={postId} postVisibility={commentsVisibility} depth={0} canComment={thread.canComment} replyingTo={replyingTo} setReplyingTo={setReplyingTo} onSend={send} onDelete={del} />
      ))}
    </div>
  )
}
```

`describeConvexError` exists in `src/lib/registrationErrors.ts` (the journal's `CommentThread` imports it the same way).

- [ ] **Step 8: Run the thread test**

Run: `pnpm vitest run tests/components/PostThread.test.tsx`
Expected: PASS. If the "private mark" assertion fails on whitespace, query with `screen.getByText(new RegExp(m.pip_written_private()))`.

- [ ] **Step 9: Write the failing card test**

`tests/components/PostCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

vi.mock('convex/react', () => ({
  useQuery: () => ({ canComment: true, comments: [] }),
  useMutation: () => vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { pip: { comments: 'pip:comments', addComment: 'pip:addComment', deleteComment: 'pip:deleteComment', react: 'pip:react' } },
}))

const { default: PostCard } = await import('../../src/components/Pip/PostCard')

const post = (over: Record<string, unknown>) => ({
  _id: 'p1',
  kind: 'session' as const,
  title: 'Office hours de septiembre',
  body: 'Sesión en vivo para platicar los videos.\n\nEntra por aquí: https://zoom.us/j/000000001\n\nTrae una situación concreta.',
  authorName: 'Mtra. Renata Fuentes',
  publishedAt: Date.parse('2026-09-10T14:00:00.000Z'),
  commentsVisibility: 'lead' as const,
  attachments: [
    { type: 'youtube' as const, videoId: 'dQw4w9WgXcQ', unavailable: false },
    { type: 'image' as const, url: 'https://files.example/h.png', name: 'Hoja' },
  ],
  reactions: [{ emoji: '🙌', count: 5, mine: false }],
  commentCount: 0,
  ...over,
})

describe('PostCard', () => {
  it('collapsed: kind, date, title, three lines of prose, the attachment summary, reactions, and the comments link', () => {
    const onToggle = vi.fn()
    render(<PostCard post={post({})} open={false} onToggle={onToggle} />)
    expect(screen.getByText(m.pip_kind_session())).toBeInTheDocument()
    expect(screen.getByText('Office hours de septiembre')).toBeInTheDocument()
    expect(screen.getByText(/Sesión en vivo para platicar/)).toBeInTheDocument()
    expect(screen.getByText(m.pip_videos_one())).toBeInTheDocument()
    expect(screen.getByText(m.pip_images_one())).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.pip_reaction({ emoji: '🙌', n: 5 }) })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.pip_comments_lead_none() }))
    expect(onToggle).toHaveBeenCalled()
    expect(screen.queryByText(m.pip_zoom())).toBeNull()
  })

  it('open: the body, the Zoom card, the tiles, and the thread', () => {
    render(<PostCard post={post({})} open onToggle={() => {}} />)
    expect(screen.getByText(/Trae una situación concreta/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: m.pip_zoom_enter() })).toHaveAttribute('href', 'https://zoom.us/j/000000001')
    expect(screen.getAllByRole('button', { name: /Abrir:|Open:/ })).toHaveLength(2)
    expect(screen.getByText(m.pip_visibility_lead())).toBeInTheDocument()
  })

  it('says comments are off, and marks an edited post', () => {
    render(<PostCard post={post({ commentsVisibility: 'off', editedAt: 1 })} open onToggle={() => {}} />)
    expect(screen.getByText(m.pip_visibility_off())).toBeInTheDocument()
    expect(screen.getByText(`· ${m.pip_edited()}`)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('names the comment count for a group thread', () => {
    render(<PostCard post={post({ commentsVisibility: 'group', commentCount: 3 })} open={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: m.pip_comments_n({ n: 3 }) })).toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Run to verify it fails**

Run: `pnpm vitest run tests/components/PostCard.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 11: Write the card**

`src/components/Pip/PostCard.tsx`:

```tsx
import * as m from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { zoomLinkIn, type CommentsVisibility, type PostKind } from '../../../convex/lib/pipRules'
import Markdown from './Markdown'
import MediaGrid, { attachmentSummary, type AttachmentView } from './MediaGrid'
import PostThread from './PostThread'
import ReactionRow, { type Reaction } from './ReactionRow'

export type PostView = {
  _id: string
  kind: PostKind
  title: string
  body: string
  authorName: string
  publishedAt: number
  editedAt?: number
  commentsVisibility: CommentsVisibility
  attachments: AttachmentView[]
  reactions: Reaction[]
  commentCount: number
}

const KIND_GLYPH: Record<PostKind, string> = { content: '▶', session: '◉', challenge: '◆' }

export function kindLabel(kind: PostKind): string {
  return kind === 'content' ? m.pip_kind_content() : kind === 'session' ? m.pip_kind_session() : m.pip_kind_challenge()
}

/** "12 de septiembre", in the reader's locale. */
export function dayLabel(ms: number): string {
  return new Intl.DateTimeFormat(getLocale() === 'en' ? 'en' : 'es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(new Date(ms))
}

/** The body's prose, headings and marks dropped, for three lines of it. */
function excerpt(body: string): string {
  return body
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('|'))
    .join(' ')
    .replace(/[*_>`]|https?:\/\/\S+|\[([^\]]+)\]\([^)]+\)/g, '$1')
}

function ZoomCard({ href }: { href: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[9px] border border-line-2 bg-wash px-3 py-2">
      <span aria-hidden="true" className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-[#2d8cff] text-[15px] text-white">▣</span>
      <div className="min-w-0 flex-1">
        <b className="block text-[13.5px] font-semibold">{m.pip_zoom()}</b>
        <span className="block truncate font-mono text-[11px] text-soft">{href}</span>
      </div>
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-sm no-underline">{m.pip_zoom_enter()}</a>
    </div>
  )
}

type Props = {
  post: PostView
  open: boolean
  onToggle: () => void
}

/**
 * A post as a card that folds. Collapsed it shows the kind, the day, the
 * title, three lines of prose, what it carries, its reactions and the way
 * into its thread; open it shows everything. Reactions stay in view either
 * way: the row is the post's pulse. Prototype E, made real.
 */
export default function PostCard({ post, open, onToggle }: Props) {
  const zoom = zoomLinkIn(post.body)
  const off = post.commentsVisibility === 'off'
  const summary = attachmentSummary(post.attachments)
  const commentsLabel = off
    ? m.pip_comments_none()
    : post.commentsVisibility === 'lead'
      ? post.commentCount
        ? m.pip_comments_lead_n({ n: post.commentCount })
        : m.pip_comments_lead_none()
      : post.commentCount === 1
        ? m.pip_comments_one()
        : m.pip_comments_n({ n: post.commentCount })

  return (
    <article id={`post-${post._id}`} className={`card px-[18px] py-[15px] sm:px-[22px] sm:py-[17px] ${open ? 'border-ink' : ''}`}>
      <button type="button" className="grid w-full gap-1 text-left" aria-expanded={open} aria-label={open ? m.pip_collapse() : m.pip_expand()} onClick={onToggle}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
            <span aria-hidden="true" className="text-ochre">{KIND_GLYPH[post.kind]}</span>
            {kindLabel(post.kind)}
          </span>
          <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">{dayLabel(post.publishedAt)}</span>
          {post.editedAt && <span className="font-mono text-[10.5px] tracking-[.06em] text-soft">· {m.pip_edited()}</span>}
          <span aria-hidden="true" className={`ml-auto text-soft transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </span>
        <span className="font-disp text-[17px] font-bold">{post.title}</span>
        {!open && <span className="line-clamp-3 text-[13.5px] leading-relaxed font-light text-soft">{excerpt(post.body)}</span>}
        {!open && summary.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {summary.map((x) => (
              <span key={x.text} className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.06em] text-soft">
                <span aria-hidden="true" className="text-ochre">{x.glyph}</span>
                {x.text}
              </span>
            ))}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3">
          <Markdown body={post.body} className="max-w-[62ch]" />
          {zoom && <div className="mt-4"><ZoomCard href={zoom} /></div>}
          {post.attachments.length > 0 && <div className="mt-4"><MediaGrid attachments={post.attachments} /></div>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ReactionRow targetKind="post" targetId={post._id} reactions={post.reactions} />
        {!open && (
          <button type="button" className="ml-auto font-mono text-[11px] tracking-[.06em] text-soft underline" onClick={onToggle}>
            {commentsLabel}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          {off ? (
            <p className="text-[12.5px] text-soft">{m.pip_visibility_off()}</p>
          ) : (
            <PostThread postId={post._id} commentsVisibility={post.commentsVisibility} />
          )}
        </div>
      )}
    </article>
  )
}
```

- [ ] **Step 12: Run the card test, then everything**

Run: `pnpm vitest run tests/components/PostCard.test.tsx` then `pnpm check`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add src/components/Pip/ReactionRow.tsx src/components/Pip/PostThread.tsx src/components/Pip/PostCard.tsx tests/components/ReactionRow.test.tsx tests/components/PostThread.test.tsx tests/components/PostCard.test.tsx
git commit -m "feat(pip): reactions with a picker that remembers, a thread with one reply box, and a post that folds

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: The feed, the route, and the link in the header

**Files:**
- Create: `src/components/Pip/PipFeed.tsx`, `src/routes/pip.tsx`
- Modify: `src/components/AppBar/AccountNav.tsx:48-60`
- Test: `tests/components/PipFeed.test.tsx`

**Interfaces:**
- Consumes: `api.pip.feed`, `api.pip.months` (Task 7); `PostCard`, `kindLabel` (Task 12); `monthKeyOf` (Task 4); `useMe` (`src/hooks/useMe.ts`); `SignedOut` from `src/routes/perfil.tsx`.
- Produces: `<PipFeed focusPostId?={string} />`; route `/pip` with search `?publicacion=<id>` (what a notification points at: that post opens at the top of the feed).

- [ ] **Step 1: Write the failing feed test**

`tests/components/PipFeed.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

let paged: { results: unknown[]; status: string; loadMore: ReturnType<typeof vi.fn> }
let lastArgs: unknown
let months: unknown

vi.mock('convex/react', () => ({
  usePaginatedQuery: (_fn: unknown, args: unknown) => {
    lastArgs = args
    return paged
  },
  useQuery: (fn: string) => (fn === 'pip:months' ? months : fn === 'pip:post' ? null : { canComment: false, comments: [] }),
  useMutation: () => vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { pip: { feed: 'pip:feed', months: 'pip:months', post: 'pip:post', comments: 'pip:comments', addComment: 'pip:addComment', deleteComment: 'pip:deleteComment', react: 'pip:react' } },
}))

const { default: PipFeed } = await import('../../src/components/Pip/PipFeed')

const post = (over: Record<string, unknown>) => ({
  _id: 'p1',
  kind: 'challenge',
  title: 'Reto de 7 días',
  body: 'Un solo cambio.',
  authorName: 'Renata',
  publishedAt: Date.parse('2026-09-12T15:00:00.000Z'),
  commentsVisibility: 'group',
  attachments: [],
  reactions: [],
  commentCount: 0,
  ...over,
})

beforeEach(() => {
  paged = { results: [], status: 'Exhausted', loadMore: vi.fn() }
  months = [{ key: '2026-09', count: 2 }, { key: '2026-08', count: 1 }]
})

describe('PipFeed', () => {
  it('says the feed is empty', () => {
    render(<PipFeed />)
    expect(screen.getByText(m.pip_empty())).toBeInTheDocument()
  })

  it('groups posts under month headers, newest first, and opens the first one', () => {
    paged = {
      results: [post({}), post({ _id: 'p2', title: 'Office hours', publishedAt: Date.parse('2026-09-10T15:00:00.000Z') }), post({ _id: 'p3', title: 'Bienvenida', publishedAt: Date.parse('2026-08-03T15:00:00.000Z') })],
      status: 'Exhausted',
      loadMore: vi.fn(),
    }
    render(<PipFeed />)
    const headers = screen.getAllByRole('heading', { level: 2 })
    expect(headers.map((h) => h.textContent)).toEqual(['septiembre 2026', 'agosto 2026'])
    expect(screen.getByRole('button', { name: m.pip_collapse() })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: m.pip_expand() })).toHaveLength(2)
  })

  it('offers the months with their counts and asks the server for the chosen one', () => {
    render(<PipFeed />)
    const select = screen.getByLabelText(m.pip_month_label())
    expect(select).toHaveTextContent('Septiembre 2026 · 2')
    fireEvent.change(select, { target: { value: '2026-08' } })
    expect(lastArgs).toMatchObject({ month: '2026-08' })
  })

  it('filters by kind through the server too', () => {
    render(<PipFeed />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_kind_challenge() }))
    expect(lastArgs).toMatchObject({ kind: 'challenge' })
    fireEvent.click(screen.getByRole('button', { name: m.pip_kind_all() }))
    expect(lastArgs).not.toMatchObject({ kind: 'challenge' })
  })

  it('opens the post a notification pointed at', () => {
    paged = { results: [post({}), post({ _id: 'p2', title: 'Office hours' })], status: 'Exhausted', loadMore: vi.fn() }
    render(<PipFeed focusPostId="p2" />)
    const open = screen.getByRole('button', { name: m.pip_collapse() })
    expect(open.closest('article')?.id).toBe('post-p2')
  })

  it('asks for more when there is more', () => {
    paged = { results: [post({})], status: 'CanLoadMore', loadMore: vi.fn() }
    render(<PipFeed />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_load_more() }))
    expect(paged.loadMore).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/components/PipFeed.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the feed**

`src/components/Pip/PipFeed.tsx`:

```tsx
import { usePaginatedQuery, useQuery } from 'convex/react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { POST_KINDS, monthKeyOf, type PostKind } from '../../../convex/lib/pipRules'
import PostCard, { kindLabel } from './PostCard'

const PAGE = 12

/** "septiembre 2026", from a `YYYY-MM` key, in the reader's locale. */
export function monthTitle(key: string): string {
  const [y, mo] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(getLocale() === 'en' ? 'en' : 'es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, mo - 1, 15)))
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

type Props = {
  /** The post a notification pointed at: opened, the others folded. */
  focusPostId?: string
}

/**
 * The member's feed. A month select and kind chips ask the server for a
 * slice; the list groups what comes back under month headers, newest
 * first. Cards fold and unfold independently; the newest one — or the one
 * a notification pointed at — starts open.
 */
export default function PipFeed({ focusPostId }: Props) {
  const [month, setMonth] = useState<string>('all')
  const [kind, setKind] = useState<'all' | PostKind>('all')
  const [openIds, setOpenIds] = useState<Set<string> | null>(null)
  const monthId = useId()
  const months = useQuery(api.pip.months) ?? []
  const { results, status, loadMore } = usePaginatedQuery(
    api.pip.feed,
    { ...(month !== 'all' ? { month } : {}), ...(kind !== 'all' ? { kind } : {}) },
    { initialNumItems: PAGE },
  )

  // Until the reader touches a card, "open" means the newest post, or the
  // one the notification named. After that, it is whatever they left open.
  const open = openIds ?? new Set(focusPostId ? [focusPostId] : results[0] ? [results[0]._id] : [])
  const toggle = (id: string) =>
    setOpenIds((s) => {
      const next = new Set(s ?? open)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-line py-2.5">
        <label htmlFor={monthId} className="sr-only">{m.pip_month_label()}</label>
        <select id={monthId} className="fld-input h-[34px] w-auto py-0 pr-8 text-[13px]" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">{m.pip_months_all()}</option>
          {months.map((x) => (
            <option key={x.key} value={x.key}>{cap(monthTitle(x.key))} · {x.count}</option>
          ))}
        </select>
        <div className="flex gap-1.5 overflow-x-auto">
          <button type="button" className="chip chip-toggle flex-none" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{m.pip_kind_all()}</button>
          {POST_KINDS.map((k) => (
            <button key={k} type="button" className="chip chip-toggle flex-none" aria-pressed={kind === k} onClick={() => setKind(k)}>{kindLabel(k)}</button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {status === 'LoadingFirstPage' && <p className="text-soft">{m.common_loading()}</p>}
        {status !== 'LoadingFirstPage' && results.length === 0 && (
          <p className="text-soft">{month === 'all' && kind === 'all' ? m.pip_empty() : m.pip_no_match()}</p>
        )}
        {results.map((p, i) => {
          const prev = results[i - 1]
          const key = monthKeyOf(p.publishedAt)
          const newMonth = month === 'all' && (!prev || monthKeyOf(prev.publishedAt) !== key)
          return (
            <div key={p._id} className="grid gap-3">
              {newMonth && (
                <h2 className="mt-3 flex items-center gap-4 font-mono text-[11px] tracking-[.14em] uppercase text-soft first:mt-0">
                  {monthTitle(key)}
                  <span aria-hidden="true" className="h-px flex-1 bg-line" />
                </h2>
              )}
              <PostCard post={p} open={open.has(p._id)} onToggle={() => toggle(p._id)} />
            </div>
          )
        })}
        {status === 'CanLoadMore' && (
          <button type="button" className="btn btn-ghost justify-self-center" onClick={() => loadMore(PAGE)}>{m.pip_load_more()}</button>
        )}
      </div>
    </>
  )
}
```

The month-header test expects `'septiembre 2026'` lowercase from the `h2` — `Intl` in `es-MX` gives lowercase month names, and the `uppercase` class is CSS only, so `textContent` stays lowercase. The select's option is capitalised by `cap`.

- [ ] **Step 4: Run the feed test**

Run: `pnpm vitest run tests/components/PipFeed.test.tsx`
Expected: PASS. If the `toEqual(['septiembre 2026', 'agosto 2026'])` assertion differs by the ICU data in the test's Node (`"septiembre de 2026"`), assert with `toMatch(/septiembre.*2026/)` per header instead.

- [ ] **Step 5: The route**

`src/routes/pip.tsx`:

```tsx
import { Show } from '@clerk/tanstack-react-start'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import PipFeed from '../components/Pip/PipFeed'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'
import { SignedOut } from './perfil'

/**
 * The member's PIP. `?publicacion=` is the post a notification pointed
 * at: it opens at the top of the feed. A non-member who is not a lead is
 * sent to their registration, the page that says where they stand.
 */
export const Route = createFileRoute('/pip')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.nav_pip() }) }] }),
  validateSearch: (s: Record<string, unknown>): { publicacion?: string } =>
    typeof s.publicacion === 'string' && /^[a-z0-9]{10,64}$/i.test(s.publicacion) ? { publicacion: s.publicacion } : {},
  component: PipPage,
})

function PipPage() {
  return (
    <>
      <Show when="signed-out">
        <SignedOut />
      </Show>
      <Show when="signed-in">
        <Pip />
      </Show>
    </>
  )
}

function Pip() {
  const { publicacion } = Route.useSearch()
  const me = useMe()
  if (me === undefined) {
    return (
      <main className="col pt-[38px] pb-[90px]">
        <p className="text-soft">{m.common_loading()}</p>
      </main>
    )
  }
  if (me === null || !(me.member || can(me.roles, 'publish_pip'))) return <Navigate to="/mi-registro" replace />
  return (
    <main className="col col-720 pt-[38px] pb-[90px] lg:max-w-[880px]">
      <p className="eyebrow">{m.pip_eyebrow()}</p>
      <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">{m.pip_title()}</h1>
      <p className="mt-2 max-w-[62ch] font-light text-soft">{m.pip_intro()}</p>
      <PipFeed focusPostId={publicacion} />
    </main>
  )
}
```

Run `pnpm generate-routes` so `src/routeTree.gen.ts` lists `/pip`.

- [ ] **Step 6: The link in the header**

In `src/components/AppBar/AccountNav.tsx`, inside `accountLinks`, after the `/bitacora` link:

```tsx
      {member && (
        <Link to="/pip" className="text-white/72 no-underline hover:text-white">
          {m.nav_pip()}
        </Link>
      )}
```

The bell for a lead already follows from Task 9's `canReceiveNotifications`. The lead's own way into the PIP is the next plan's `/administracion/pip`; until then a lead reaches the feed by URL.

- [ ] **Step 7: Verify in the browser**

Run: `pnpm check`, then start the dev server (`preview_start` with `xuntas-registro`, or `pnpm dev`) and open `/es/pip` signed in as a member. Before Task 14 seeds posts the page must read "Todavía no hay publicaciones." under the toolbar, with the month select empty and the header showing "PIP" beside "Bitácora". As a non-member athlete, `/es/pip` must redirect to `/es/mi-registro`.

- [ ] **Step 8: Commit**

```bash
git add src/components/Pip/PipFeed.tsx src/routes/pip.tsx src/routeTree.gen.ts src/components/AppBar/AccountNav.tsx tests/components/PipFeed.test.tsx
git commit -m "feat(pip): the member's feed at /pip — month select, kind chips, posts that fold, a link in the header

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: A seed, and the feed driven end to end

Until the lead's screen exists, posts come from an internal mutation run from the CLI. It writes the prototype's material as real rows so the feed can be judged with real data, real reactions and real threads.

**Files:**
- Modify: `convex/pip.ts` (append)

- [ ] **Step 1: Append the seed**

```ts
// ---------------------------------------------------------------------------
// Development seed. Run by hand, never from the app:
//
//   pnpm convex run pip:seedDemo '{"leadEmail":"someone@example.com"}'
//
// Grants `pip_lead` to that account if it lacks it, and publishes five
// posts to everyone. Idempotent by title: a post that exists is skipped.

const DEMO_POSTS: { kind: PostKind; title: string; body: string; commentsVisibility: 'off' | 'lead' | 'group'; daysAgo: number; youtube?: string[] }[] = [
  {
    kind: 'challenge',
    title: 'Reto de 7 días: tres respiraciones antes de cada tiro largo',
    body: 'Un solo cambio, concreto y pequeño, que se conecte con los videos de este mes.\n\n- **Qué:** tres respiraciones completas antes de cada tiro con madera o híbrido.\n- **Cuándo:** siete días seguidos, en práctica y en torneo.\n- **Cómo lo cuentas:** un comentario aquí al terminar la semana. Qué cambió, qué no.\n\nNo hay respuesta correcta. Lo que quiero leer es lo que notaste.',
    commentsVisibility: 'group',
    daysAgo: 2,
  },
  {
    kind: 'session',
    title: 'Office hours de septiembre',
    body: 'Sesión en vivo para platicar los dos videos del mes y cómo llevarlos a tu día a día y al golf. Cada grupo tiene su propio horario.\n\n**Jueves 17 de septiembre**\n\n- XUNTAS · menores de 19: 17:00 h (CDMX)\n- XUNTOS · menores de 19: 18:15 h (CDMX)\n- XUNTAS · 19 años o más: 19:30 h (CDMX)\n- XUNTOS · 19 años o más: 20:45 h (CDMX)\n\nEntra por aquí: https://zoom.us/j/000000001\n\nTrae una situación concreta de las últimas dos semanas donde te hayas frustrado.',
    commentsVisibility: 'lead',
    daysAgo: 4,
  },
  {
    kind: 'content',
    title: 'Manejo de la frustración: los dos videos del mes',
    body: '## Este mes trabajamos qué hacemos con el error\n\nCómo lo interpretamos, cuánto tiempo lo cargamos y cómo volvemos al presente.\n\nDespués de cada video, escribe qué aprendiste o qué te hizo pensar. **Tu comentario lo leo solo yo.**\n\n> Dos atletas con el mismo doble bogey terminan la ronda de forma distinta. La diferencia no está en el golpe: está en la historia que se cuentan después.',
    commentsVisibility: 'lead',
    daysAgo: 13,
    youtube: ['dQw4w9WgXcQ', 'xxxxxxxxxxx'],
  },
  {
    kind: 'challenge',
    title: 'Reto de agosto: anotar un aprendizaje al terminar cada práctica',
    body: 'Una línea. No un párrafo. Una línea al cerrar la bolsa, siete días seguidos.\n\nAl terminar la semana, cuéntame aquí cuál fue la que más te sorprendió.',
    commentsVisibility: 'group',
    daysAgo: 21,
  },
  {
    kind: 'content',
    title: 'Bienvenida al Programa Integral de Performance',
    body: '## Qué es esto\n\nCada mes vas a encontrar aquí dos videos, una sesión en vivo por grupo y un reto de siete días. Nada de esto se califica.\n\n### Lo que sí te pido\n\n1. Ver los videos antes de la sesión.\n2. Escribir después de cada uno, aunque sea una línea.\n3. Llegar a la sesión con una situación real.\n\n| Mes | Tema |\n| - | - |\n| Septiembre | Manejo de la frustración |\n| Octubre | Rutina pre-tiro |',
    commentsVisibility: 'off',
    daysAgo: 42,
  },
]

export const seedDemo = internalMutation({
  args: { leadEmail: v.string() },
  handler: async (ctx, args) => {
    const lead = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.leadEmail.trim().toLowerCase()))
      .unique()
    if (!lead) fail('user_not_found')
    if (!lead.roles.includes('pip_lead')) await ctx.db.patch(lead._id, { roles: [...lead.roles, 'pip_lead'] })

    const existing = await ctx.db.query('pipPosts').collect()
    const titles = new Set(existing.map((p) => p.title))
    const now = Date.now()
    let created = 0
    for (const d of DEMO_POSTS) {
      if (titles.has(d.title)) continue
      const at = now - d.daysAgo * 24 * 60 * 60 * 1000
      await ctx.db.insert('pipPosts', {
        authorId: lead._id,
        kind: d.kind,
        title: d.title,
        body: d.body,
        attachments: (d.youtube ?? []).map((videoId, i) => ({ type: 'youtube' as const, videoId, unavailable: i === 1 })),
        groupIds: [],
        commentsVisibility: d.commentsVisibility,
        status: 'published',
        publishedAt: at,
        createdAt: at,
        updatedAt: at,
        commentCount: 0,
        reactionCount: 0,
      })
      created++
    }
    console.log(`[pip.seedDemo] ${created} posts for ${lead.email}`)
    return { created }
  },
})
```

`by_email` is the users index `convex/http.ts` and `staff.ts` already use.

- [ ] **Step 2: Run it against the dev deployment**

```bash
pnpm exec convex dev --once
pnpm convex run pip:seedDemo '{"leadEmail":"<the master admin's email>"}'
```

Expected: `{ created: 5 }`.

- [ ] **Step 3: Drive the feed**

Signed in as the test athlete whose registration is `selected` (select it from Administración › Registros if it is not), open `/es/pip` and check, with the Browser pane or Chrome:

1. Two month headers, the newest post open, four folded with three-line excerpts; the content post's collapsed row reads "2 videos (1 no disponible)".
2. The welcome post says comments are off and shows a table.
3. The session post shows the Zoom card when opened.
4. Press "☺ Reaccionar" on a post, pick 🔥: the chip appears pressed with 1; press it again: it goes. Reload: the reaction persists.
5. Write a comment on the challenge (group), reply to it, delete the reply. The counts in the folded label follow.
6. Write under the content post (lead-only): the composer says nobody else reads it. Sign in as the lead: the comment is there under that post, with a bell notification "Hay comentarios nuevos en …"; write a reply; sign in as the member again: the bell says "… respondió a tu comentario …" and opening it lands on `/pip?publicacion=<id>` with that post open.
7. Open the content post's first tile: the lightbox embeds YouTube; the second tile is the error card in the lightbox too; Escape closes.
8. Pick "agosto 2026" in the select: one post; pick "Reto": the two challenges.
9. Signed in as the non-member athlete: `/es/pip` redirects to `/es/mi-registro`.

Fix whatever step fails before committing.

- [ ] **Step 4: Commit**

```bash
git add convex/pip.ts
git commit -m "chore(pip): a dev seed that publishes five demo posts to everyone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: The decision on record

**Files:**
- Modify: `docs/DECISIONS.md` — under `## Product`, after the "Notifications are in-app only" paragraph

- [ ] **Step 1: Write the decisions**

```markdown
**The PIP is a feed, not a monthly template.** The prototype's fixed
month (theme, two videos, four office hours, a tracker, a private journal)
became posts a `pip_lead` publishes to groups on a schedule, with any-emoji
reactions and threads that are private to the lead by default. The monthly
rhythm survives as month headers. Visibility is computed from current group
membership at read time — a late joiner sees the past, a removed member
sees nothing — and never fanned out. A comment keeps the visibility it was
written under, so flipping a post exposes only what comes after. Delete only
while nothing was said or felt; otherwise unpublish. Full design:
`docs/superpowers/specs/2026-09-14-pip-posts-groups-design.md`.

**The feed's shape was prototyped, five variants, three rounds.** Verdict:
E — a month select and kind chips in a static toolbar, posts as cards that
fold with three lines and an attachment summary, reactions in view either
way, a lightbox for attachments, one reply box per thread. The variants
live on `proto/pip-feed`.

**Bodies are markdown, rendered without HTML.** Posts and comments now; the
bitácora once the editor lands. `react-markdown` treats raw HTML as text,
which is the sanitising. The journal's title limit dropped to 100 to match a
post's.
```

- [ ] **Step 2: Final check and commit**

Run: `pnpm check`
Expected: PASS.

```bash
git add docs/DECISIONS.md
git commit -m "docs: the PIP decisions — a feed, computed visibility, markdown without HTML

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin feat/pip-feed
```

Then open the PR against `main` with the spec, the verdict, and the nine checks from Task 14 in its body, and mention that PR #22 (`feat/full-height-tables`) is its base until that merges.

---

## Self-review

**Spec coverage.** §1 roles and permissions → Task 2. §2 groups → Tasks 6, 7 (data and mutations; the screen is the next plan). §3 posts, four states, computed visibility, edit/unpublish/delete, feed order, no cycle → Tasks 4, 6, 7, 13. §4 media → Task 6 (attachment shape), Task 11 (tiles, error card, Zoom card, YouTube embed); the attach-time check and uploads are the lead-screen plan. §5 comments and reactions → Tasks 5, 8, 12. §6 notifications → Task 9. §7 markdown rendering → Task 11; the editor is its own plan; the journal limit → Task 3. §8 `/pip` and the header link → Task 13; `/administracion/pip` and the invite dialog's new role → the role appears automatically (Task 2), the screen is the next plan. §9 out of scope → nothing here. §10 rollout → additive schema (Task 6), seed (Task 14), decisions (Task 15).

**Placeholders.** None: every step has its code or its command. Two steps name a fallback assertion if an environment differs (ICU month names, react-markdown text nodes) — those are stated alternatives, not gaps.

**Type consistency.** `PostView` (Task 7 server, Task 12 client) carry the same fields; `AttachmentView` is defined once in `MediaGrid.tsx` and mirrored by `postView` in `pip.ts`; `CommentView` (Task 8 server, Task 12 client) match; `Reaction` is `{ emoji, count, mine }` everywhere; `notify`'s two PIP events are spelled the same in Tasks 7, 8 and 9; `targetFor`'s `forLead` and `postId` are produced by `describe` in Task 9 and read by the existing menu and page.
