# The PIP: posts, groups, comments, reactions

**Date:** 2026-09-14
**Branches:** to be decided at planning; the markdown editor lands first
because the journal takes it too.
**Status:** designed, agreed in a grilling session; prototypes next, then a
plan.

## Problem

The Programa Integral de Performance is the psychologist's programme for
members: what to watch, what to try, when to meet, and a place to answer.
`documentation/portal_xuntas.html` sketches it as a fixed monthly template —
a theme, exactly two videos, one office-hours date split across four
cohorts, a seven-day challenge, a private journal — and gives the person who
runs it no screen at all, though its copy promises her the athletes' written
reflections. Nothing of it is modelled: no role, no permission, no table.

The template is the wrong shape. What the programme needs is a way to
**publish**, to **whom**, **when**, and a way for members to **answer**. So
the PIP is a feed: posts from a lead, sent to groups of members, released on
a schedule, with comments and reactions. The monthly rhythm survives as
month headers over the feed, not as a form the lead must fill in twice.

This spec also moves the app's text to markdown. A post is a long-form
letter with headings and lists; the bitácora wanted the same and got plain
text because nothing else needed more. One editor serves both.

### What this reverses in `docs/DECISIONS.md`

- "The bitácora is dated by the athlete and read by the team, whole" stays.
  Its body becomes markdown, rendered through a sanitiser; its title limit
  drops from 120 to 100 to match a post's. Nothing is in production, so no
  migration.
- "Notifications are in-app only" stays and grows three kinds.
- The journal spec's out-of-scope line "the PIP's private journal" stays
  out. The PIP has no private journal.

## 1. Roles and permissions

A new role, **`pip_lead`**, appended to `ROLES`. It is granted through the
existing staff invite, like `coach` and `health`. Any number of leads; they
share every group and every post, and each post shows its author. `pip_lead`
is not assignable to athletes (`canBeAssigned` already excludes roles
without `view_assigned_athletes`).

Three permissions, appended to `PERMISSIONS` in this order — the table is
append-only, `permissionsOf` promises its order:

| permission | what it allows | granted to |
| - | - | - |
| `view_members_basic` | the member list as name, rama, age — nothing else | `pip_lead`, `master_admin` |
| `manage_pip_groups` | create, rename, archive groups; add and remove members | `pip_lead`, `master_admin` |
| `publish_pip` | write, schedule, publish, edit, unpublish, delete posts; hide comments; see who reacted | `pip_lead`, `master_admin` |

`master_admin` holds them all because it holds `PERMISSIONS`, but its PIP
screen renders read-only: oversight, not authorship. The read-only rule is
the screen's, keyed on `roles.includes('pip_lead')`, and the mutations do
not know about it — a master admin who writes through the API is a master
admin. `admin`, `coach`, `health` and `finance` see nothing of the PIP. The
mock's promise to the athlete — "ni tu coach" — holds; the association's
recourse if the lead leaves is the master admin.

`view_members_basic` is new rather than a reuse of `view_all_athletes`
because that one unlocks the journal, and the lead must not read it.

## 2. Groups

A group is the lead's working vocabulary for "who gets this". Built by
hand from the basic member list; rule-based membership (rama × age band,
the mock's cohorts) waits until the lead has run a month and knows which
splits she uses. The list she picks from is every member — a `selected`
registration in any cycle — with rama from `registrations.personal.branch`
and age from `users.birthDate`. Nothing new to collect.

```
pipGroups { name, createdBy, createdAt, archivedAt? }
  by_archived
pipGroupMembers { groupId, athleteUserId, addedBy, addedAt, removedAt? }
  by_group_active [groupId, removedAt]
  by_athlete_active [athleteUserId, removedAt]
```

- **"Todos los miembros"** is a virtual group, not a row: every member is
  in it, it cannot be archived or edited, and it is the default target of
  a new post. It resolves to "every current member" at read time.
- Groups are **renamed and archived, never deleted**. An archived group
  receives nothing new, is hidden from the targeting picker, and keeps its
  history so an old post still says who it went to.
- Membership rows are **ended, never deleted**, the same as assignments.
  Removing a member from the programme (`removed`) ends every row of theirs
  in the same mutation.
- **Members never see group names.** Their screen is the feed.

## 3. Posts

One shape. A `kind` label changes the icon and the eyebrow and nothing
else; typed posts would multiply screens for no data benefit.

```
pipPosts {
  authorId, kind: 'content' | 'session' | 'challenge',
  title, body,                           -- title ≤ 100, body markdown ≤ 10 000
  attachments: [{ type: 'image' | 'video', storageId } | { type: 'youtube', videoId }],
  groupIds: Id<'pipGroups'>[],           -- empty = "todos"
  commentsVisibility: 'off' | 'lead' | 'group',  -- default 'lead'
  status: 'draft' | 'scheduled' | 'published' | 'unpublished',
  scheduledFor?, publishedAt?, editedAt?, unpublishedAt?,
  createdAt, updatedAt,
  commentCount, reactionCount            -- denormalised, kept by the mutations
}
  by_status_scheduled [status, scheduledFor]
  by_published [status, publishedAt]
```

- **Four explicit states.** A draft has no release; it does not release
  because the lead typed a date early. Scheduling sets `scheduledFor` and a
  `ctx.scheduler.runAt` job; editing the date cancels and reschedules;
  moving back to draft cancels. The job re-checks the row is still
  `scheduled` before publishing — a stale job publishes nothing.
  `scheduledFor` is entered in Mexico City time and stored as ms.
- **Targets are several groups, deduplicated at read.** A member in two
  targeted groups sees the post once. The common case is "todos" plus one
  cohort reminder; one group per post means posting twice.
- **Visibility is computed, not fanned out.** A member sees a published
  post if `groupIds` is empty or intersects their active groups. A member
  added to a group later sees its past; a person with no `selected`
  registration left — removal in one cycle while another cycle still reads
  `selected` keeps them a member, as §2 defines it — sees nothing. Read
  access lives in one place, `convex/lib/pipAccess.ts`, the way
  `athleteAccess.ts` does for the journal.
- **After release**: edit freely, stamped `editedAt` and shown as
  "editado". Delete only while `commentCount + reactionCount === 0`;
  otherwise unpublish, which hides the post from members and keeps the
  thread for the lead and the master admin. Unpublish is reversible.
- **Feed order**: newest `publishedAt` first, under month headers. No
  pinning. No view tracking: a write on every read and a privacy question
  the promise to members does not need; reactions and comments are the
  signal.
- Posts belong to no cycle. Members span cycles, and a reselected member
  should still find last year's material.

## 4. Media

| type | accepted | limit | stored |
| - | - | - | - |
| image | JPG, PNG, WebP | 10 MB | Convex file storage |
| video | MP4, WebM | 250 MB | Convex file storage, no transcoding |
| youtube | a watch, short or youtu.be URL | — | the video id |

Up to ten attachments per post, any mix, in the order attached. The upload
field says, next to the video limit, that longer videos belong on YouTube
as unlisted. Uploads go through Convex upload URLs; the mutation checks the
stored file's content type and size and refuses what the table above does
not list.

**Availability**, checked twice and never by cron. On attach, a YouTube id
is checked against the oEmbed endpoint from an action and refused if it
answers nothing; a stored file is checked to exist. On render, a YouTube
embed that fails to load, or a storage URL that resolves to nothing, shows
an error card in place — the same card on the member's feed and on the
lead's list, so she finds out where the member did. A daily re-check is
more machinery than the failure warrants.

A `zoom.us` link anywhere in the body renders as a "Sesión por Zoom" card
with the link. Times stay plain text in the body; no session fields.

## 5. Comments and reactions

```
pipComments {
  postId, authorId, parentId?,            -- one level: a comment, and replies to it
  body,                                    -- markdown, inline subset, ≤ 2 000
  visibility: 'lead' | 'group',            -- copied from the post at write time
  hiddenAt?, hiddenBy?,
  createdAt, replyCount
}
  by_post_parent [postId, parentId, createdAt]
pipReactions { targetId: Id<'pipPosts'> | Id<'pipComments'>, targetKind, userId, emoji, createdAt }
  by_target [targetKind, targetId]
  by_target_user [targetKind, targetId, userId, emoji]
```

- **Per post, the lead sets who reads the comments**: the group, the lead
  and each author alone, or nobody — comments off, no composer, no thread.
  Default is lead-only — the mock's reflections were private, and a
  challenge the lead wants public is a choice she makes when she writes
  it. The setting can be changed later; switching comments off keeps what
  was written and hides the composer.
- **A comment keeps the visibility it was written under.** Flipping a post
  to group-visible exposes only comments written after the flip. A member
  who wrote in confidence stays in confidence; the lead cannot undo a
  consent she did not have.
- Who may comment: members who can read the post, and leads. Under
  `lead` visibility a member sees their own comment, replies to it, and
  nothing else. Under `group` they see every non-hidden comment.
- **No editing. Authors delete their own.** The lead may **hide** any
  comment: gone from the group, shown to its author with a "oculto" mark
  and no reason (silent removal makes people repost), still readable by the
  lead and the master admin. Hidden is reversible. Delete is refused once a
  comment has replies or reactions — the same rule the journal uses for
  entries — so a thread never loses its root.
- **Reactions are any emoji**, several per member, on posts and top-level
  comments. Counts are visible to everyone who can read the target; who
  reacted is visible on hover to leads only. The picker is WhatsApp's: a
  quick row of five, a plus that opens the full library with search, and
  the quick row reordered to most recently used, stored per device in the
  browser.
- A comment by a member since removed stays in the thread; their name
  carries an "ya no forma parte del programa" indicator on hover or long
  press.

## 6. Notifications

In-app only, through the existing `notifications` table, three new kinds
appended to `kind`:

| kind | to | when |
| - | - | - |
| `pip_post_published` | every member the post reaches, at release | a post moves to `published` |
| `pip_comment_reply` | the comment's author | someone replies to their comment |
| `pip_comment_new` | every lead | a member comments; **one unread per post**, not per comment |

The batching for `pip_comment_new` is a lookup before insert: an unread
notification for the same lead and post is left alone, not duplicated.
Nothing for reactions. Nothing for a member added to a group; they see the
feed. The actor never hears about their own act. The existing bell, the
unread count and the 90-day prune cover these without change. Rules live in
`notificationRules.ts` beside the journal's.

Release-time fan-out is the one place membership is read at a moment
rather than computed: a member joining a group later sees the post but is
not notified of it.

## 7. Editor and markdown

One editor, **Tiptap**, serialising to markdown, used by the post composer,
the bitácora entry form and the comment box. Nobody types asterisks on a
phone. Rendering goes through a markdown parser and a sanitiser; raw HTML
in a body is text, never markup.

| where | subset |
| - | - |
| posts, journal entries | headings h2 and h3, bold, italic, bullet and numbered lists, links, block quotes, basic tables |
| comments | bold, italic, links, lists |

No inline images: images are attachments. The journal's `TITLE_LIMIT`
drops to 100; its body stays at 5 000 and becomes markdown. Existing
plain-text entries render unchanged, since plain text is markdown, and
nothing is in production to migrate.

The markdown subset, the limits and the sanitiser configuration live in
one pure module, `convex/lib/markdownRules.ts`, imported by the browser
and by Convex, so a body the editor accepts is a body the mutation accepts.

## 8. Screens

- **`/pip`** — the member's feed. A "PIP" link joins Mi perfil and Bitácora
  in the header, offered to members only. Month headers, posts newest
  first, each with its attachments, its reactions, and its thread under a
  disclosure. Removed members are redirected to `/mi-registro` like the
  other member pages.
- **`/administracion/pip`** — the lead's screen, a tab in the
  administration frame, which any staff role already enters. Two panes:
  **Publicaciones** (drafts, scheduled, published, unpublished, with the
  composer) and **Grupos** (the list, the member picker with name, rama and
  age, archive). A master admin sees the same screen with every action
  disabled.
- **`/administracion/equipo`** — the invite dialog offers `pip_lead`.
- **`/bitacora`** and the athlete pages — the entry form and the entry body
  switch to the editor and the renderer. No other change.

## 9. Out of scope

Custom forms and the mock's seven-day tracker with its progress meter —
a form engine that must later carry registrations deserves its own spec
(ticketed separately). Rule-based groups. The weekly "video de la semana"
as a feature: it is a post. The private PIP journal. Email. View tracking.
Pinning. Comment editing. Video transcoding or private streaming. Reasons
on hidden comments.

## 10. Rollout

Schema changes are additive: one role value, three permissions, three
notification kinds, five tables. Convex deploys before the container. The
editor lands first, on the journal, so the PIP arrives on a renderer that
already works. Prototypes before the plan: the feed and the composer as UI
variations, and the post and comment visibility rules as a logic demo, so
the private-by-default thread is driven through its cases before it is
built.
