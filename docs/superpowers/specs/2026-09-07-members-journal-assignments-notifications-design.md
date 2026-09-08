# The program after selection: members, assignments, bitácora, notifications

**Date:** 2026-09-07
**Branches:** one, `feat/members-removal`, cut from `main` after PR #20; six
commits in the order of the sections below, each leaving `pnpm check` green.
**Status:** implemented, awaiting review and a manual pass against the dev
deployment.

## Problem

Once the Consejo Técnico selects an athlete, the app has nothing for them.
`/mi-registro` collapsed a `selected` registration into a "Borrador" pill
and offered no page past it. `documentation/portal_xuntas.html` sketches an
athlete portal — a profile, a bitácora, a coach view — but models none of
it: no entry type, comments hanging off the athlete rather than an entry,
and coach assignment faked by matching a name in a text field. `coach` and
`health` existed in `users.roles` and granted nothing.

Five things, one subsystem: what happens to a member.

1. **Membership needs an end.** Administration must be able to let a member
   go, and tell them.
2. **Coaches and health specialists need their athletes**, and only theirs.
3. **The athlete needs a place to write** after a tournament or a session,
   and a place to read what the team said.
4. **The team needs a place to answer**, under an entry or about the whole
   process.
5. **Everyone needs to hear** when the other side wrote, without email.

### What this reverses in `docs/DECISIONS.md`

- "`coach`, `finance` and `health` exist so they can be invited now; their
  screens come later" → `coach` and `health` have screens now; `finance`
  still does not.
- "Deletion really deletes" stays true and grows: an account's journal,
  assignments and notifications go with it.

Search was designed for and dropped: Convex removed typo-tolerant matching
in January 2025, and a Levenshtein search over a corpus this small was the
point; a prefix search was not. The date range stays.

---

## 1. Permissions

Five new entries, appended to `PERMISSIONS` (the order is a tested promise):

| permission | admin | master_admin | coach | health | finance |
|---|---|---|---|---|---|
| `view_assigned_athletes` — the members assigned to me | – | ✓ | ✓ | ✓ | – |
| `view_all_athletes` — every member, and frozen journals | ✓ | ✓ | – | – | – |
| `comment_journal` — write in a journal I may read | ✓ | ✓ | ✓ | ✓ | – |
| `manage_assignments` — pair staff with members | ✓ | ✓ | – | – | – |
| `remove_athletes` — end and restore a membership | ✓ | ✓ | – | – | – |

`convex/lib/athleteAccess.ts` turns four facts — permissions, self,
assigned, member — into three answers: `canReadAthlete`, `canWriteEntries`,
`canCommentOn`. `convex/members.ts` works the facts out from the database
(`requireAthleteAccess`) and every journal read goes through it. A missing
person fails `athlete_not_found`; a real one the actor may not see fails
`permission_required`, so an id guessed from outside learns nothing.

## 2. Membership and removal

**A member is a person with a registration that reads `selected`**, in any
cycle. Last year's member is still one while this year's window is open.
One index, `registrations.by_status_user`, answers both "is this person
in" and "who is in".

**`removed` is a seventh status and a fifth decision.** Reachable only from
`selected`; back only to `selected`. `admin` or `master_admin`, via
`remove_athletes`, always with a note, and ignoring the notice lock — the
selection email already went out, that is the point. It flows through
`registrations.decide` like every decision, so the log, the chips and the
panel already know it. `decide` schedules the removal email itself, at once,
through `emails.sendDecisionNotice`; nobody presses a button for it, and
`notices.sendBatch` skips it. Reinstating clears `decisionNotice` so the
row can never sit as `not_sent` where a batch would find it.

Removal ends every active assignment (the staff hear; the athlete gets the
email and no bell, since the bell would ring into a page they lost). The
athlete keeps the account and `/mi-registro`, loses `/perfil`, `/bitacora`
and `/notificaciones`. Administration keeps the frozen journal, read-only;
nobody writes in it again, the athlete included.

## 3. Assignments

`assignments { staffUserId, athleteUserId, assignedBy, assignedAt, endedAt? }`,
open-ended — not per cycle. A row ends, it is never deleted, so a comment
written under it keeps its context. Three indexes: active by staff, active
by athlete, and the pair.

Only a role whose access is "assigned athletes" and nothing wider can be
assigned (`canBeAssigned`): a coach who is also an admin sees everyone and
has no list to fill. From the staff row in `/administracion/equipo`,
"Atletas" opens a checkbox list of current members; the whole list is saved
(`assignments.setForStaff`), and `diffAssignments` turns it into adds and
ends. The member's team shows read-only under the decision panel, on the
athlete's page for staff, and on the athlete's own profile.

## 4. The bitácora

`journalEntries { athleteUserId, kind, title, date, body, score?, createdAt,
editedAt?, commentCount }`, index `by_athlete_date`. `kind` is `tournament`
or `training`; only a tournament carries a score. `date` is the athlete's
own — the day it happened, not the day of writing — an ISO day no later
than today in Mexico City, so it sorts as a string and the index orders the
feed. Limits: title 120, body 5,000, score 40. No tags, no privacy flag:
every entry is read by whoever may read the athlete, by decision.

Edits keep the entry and stamp `editedAt` ("Editada · fecha"); they tell
nobody. Deletion is refused once anything has been said under the entry.

The feed is `usePaginatedQuery`: a hundred first, fifty more as a sentinel
nears the end, and a visible "Cargar más" for anyone without a scroll or an
observer. The date range (`RangeField`, inclusive both ends) re-runs the
query from the top rather than filtering what is loaded — the entries a
range is for are the ones the page does not hold. `?entrada=` leads the
feed with one entry and its thread open; that is where a notification
lands.

`journalStats { athleteUserId, entryCount, lastEntryDate? }` is kept by the
entry mutations so the staff list is one read per row.

## 5. Comments

`journalComments { athleteUserId, entryId?, authorId, body, createdAt }`,
one index `by_athlete_entry`. No `entryId` is the athlete's general stream,
shown above the feed on both the athlete's page and the staff's: the place
to write about the process as a whole, and the first thing a coach reads on
a member who has not written yet. Both surfaces newest first, by decision.

Writers: `coach`, `health`, `admin`, `master_admin` on an athlete they may
read, and the athlete on their own. ≤ 2,000 characters. Authors delete
their own, hard; nobody edits; nobody moderates. A frozen journal takes no
more words from anyone. Each comment shows the author's role.

## 6. Notifications

In-app only. `notifications { userId, kind, actorId, athleteId, entryId?,
commentId?, createdAt, readAt? }`. `convex/lib/notificationRules.ts`
decides who hears:

- staff comment on an entry → the athlete; athlete reply → the staff who
  already wrote in that thread. The general stream, the same pair.
- new entry → every staff member assigned right now.
- assignment created or ended → both parties.
- removal → nothing in-app.

The actor never hears about their own act; administration hears only
where it spoke first. A bell in the bar carries the unread count and the
latest ten; opening one marks it read and goes where it points — the
athlete's own journal, or the athlete's page for staff. `/notificaciones`
is the same list without the cap. A daily cron prunes read rows older
than ninety days; unread ones stay.

## 7. Screens

- **`/perfil`** — the registration the Consejo selected, read-only, the
  team beside it. Non-members are sent to `/mi-registro`.
- **`/bitacora`** — "Nueva entrada" (the screen's one solid yellow) opening
  a dialog; the general stream; the feed.
- **`/notificaciones`** — the bell's list, whole.
- **`/administracion/atletas`** — the members this account may see, newest
  writing first, filtered by rama; administration also sees each member's
  team. A coach lands here from `/administracion`.
- **`/administracion/atletas/$id`** — one member: general stream and feed
  with the comment box (the screen's yellow), a compact profile card, the
  team for administration, the full record behind a disclosure. A removed
  member's page says so.
- **`/administracion/registros/$id`** — the decision panel gains "Dar de
  baja" on a member and "Reincorporar" on a removed one; the team card
  sits under it.
- **`/administracion/equipo`** — "Atletas" on assignable rows.
- **`/mi-registro`** — the third pill reads "Programa de Desarrollo" for a
  member.

## 8. Out of scope

Text search (see above). Tags. Per-entry privacy and the PIP's private
journal. Comment editing and moderation. Email for comments and entries.
The prototype's measured stats (ball speed, sizes) and its file uploads.

## 9. Rollout

All schema changes are additive; Convex deploys before the container. The
`_generated/api.d.ts` in this branch was written by hand to the generator's
format because the worktree has no deployment; `npx convex dev` produces
the same file. No Convex function is covered by a test — the rules under
them are — which is the existing debt, now larger.
