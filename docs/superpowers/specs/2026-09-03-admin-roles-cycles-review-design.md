# Administration: roles, invitations, cycles, and registration review

**Date:** 2026-09-03
**Branches:** four, in order — `feat/roles-and-invitations`,
`feat/cycles-and-window`, `feat/admin-review`, `feat/athlete-decisions`.
Each is cut from `main` after the previous one merges.
**Status:** designed, not implemented.
**Plans:** one per branch, in `docs/superpowers/plans/2026-09-03-*.md`.

## Problem

Four things, one subsystem: who may do what.

1. **Nobody can administer from the app.** `registrations.listForAdmin` and
   `registrations.review` exist ([`convex/registrations.ts:275`](../../../convex/registrations.ts))
   but have no screen; without the app, the review must run from the Convex
   dashboard by hand. The Council reviews on September 23.
2. **Roles are a single Clerk-owned enum.** `users.role` is `'athlete' | 'admin'`,
   mirrored from `publicMetadata.role` on every webhook. Adding a person means
   editing JSON in Clerk's dashboard; adding a role means a schema change and
   a webhook change. The program wants `coach`, `finance` and `health` next.
3. **The window is a constant.** `OPENS_AT_MS`/`CLOSES_AT_MS` live in
   `convex/lib/cycle.ts`. The call runs again in 2027 and there is no way to
   move the dates without a deploy — and the development hatch
   `WINDOW_ALWAYS_OPEN` is a second, invisible way to be open in production.
4. **No decision ever reaches the athlete.** `validated`/`rejected` are
   written and never displayed or emailed.

Production being closed today is **not** one of the problems: it is the
constant doing what it says (opens September 4, 00:00 Mexico City).

### What this reverses in `docs/DECISIONS.md`

- "The admin table comes later" → it comes now.
- "Emails that get an admin invitation are added from Clerk" → invitations are
  the app's, and Convex owns roles.
- Open item 2 (guardian never confirms) → decided below (§6).
- "The window runs September 4–18, 2026. The constants live in
  `convex/lib/cycle.ts` and nowhere else" → the dates live in the `cycles`
  table; the constants become the seed for the 2026–2027 row.
- "`wasMinorAtSignup` is frozen" stays true; a *per-cycle* value is added
  beside it (§7).

The doc gets amended, not contradicted — the amendments are a task in each
plan.

---

## 1. Roles and permissions

### Roles

`users.roles: Array<Role>`, where

```ts
type Role = 'athlete' | 'admin' | 'master_admin' | 'coach' | 'finance' | 'health'
```

- `athlete` is a role like any other. A registrant has `['athlete']`; staff
  have no `athlete`. This makes an empty array an impossible state and lets
  the athlete panel gate on `athlete` rather than on "not staff".
- `coach`, `finance`, `health` are in the union now with no screens: the point
  of `master_admin` today is onboarding staff, and the union is being migrated
  now anyway. They land on a placeholder page (§4).
- `master_admin` is a **superset**: every permission check passes for it.

### Convex owns roles

Clerk's `publicMetadata.role` is no longer read. The webhook stops writing
`role`/`roles` on `user.updated`. Roles change through three paths only:

1. `staff.grantRoles` — internal mutation, run once from the CLI to bootstrap.
2. Accepting a staff invitation (§2) — the `user.created` webhook assigns the
   invite's roles.
3. `staff.setRoles` — a `master_admin` editing the staff table.

### Permissions

`convex/lib/permissions.ts` is the only place a role is compared to anything:

| permission | admin | master_admin |
|---|---|---|
| `review_registrations` — views 1–3, detail, validate/reject | ✓ | ✓ |
| `send_rejection` — individual rejection email, any time | ✓ | ✓ |
| `select_registrations` — mark `selected` / `not_selected` | – | ✓ |
| `send_batch` — selection/not-selected batch, after close | – | ✓ |
| `view_staff` — staff list, read-only | ✓ | ✓ |
| `manage_users` — invite, edit roles, revoke | – | ✓ |
| `manage_cycles` — dates, create cycle, set active | – | ✓ |

`coach`, `finance`, `health` grant nothing yet. Adding a permission to a
future role is one line in that table.

```ts
export function can(roles: readonly Role[], permission: Permission): boolean
export function permissionsOf(roles: readonly Role[]): Permission[]
export function isStaff(roles: readonly Role[]): boolean   // any role but athlete
```

Every Convex function that guards on a role calls
`requirePermission(ctx, 'review_registrations')` from `users.ts`, which
throws `ConvexError({ code: 'permission_required' })`. `admin_required` is
retired.

### Migration (prod has rows)

Three-step schema transition, the Convex-safe way:

1. Add `roles: v.optional(v.array(vRole))`, keep `role`. Deploy.
2. Run `npx convex run users:backfillRoles` (dev, then `--prod`): every row
   gets `roles = [role]`.
3. Make `roles` required and `role` legacy-optional. Deploy, then run `users:dropLegacyRole` (Convex refuses a schema over rows that still carry a field it no longer declares). `role` leaves the schema in a later PR.

Then bootstrap:

```bash
npx convex run staff:grantRoles '{"email":"gerardogalangarzafox@gmail.com","roles":["master_admin"]}'
npx convex run staff:grantRoles '{"email":"gerardogalangarzafox@gmail.com","roles":["master_admin"]}' --prod
```

Any account that was `admin` in prod becomes `['admin']`, not `master_admin`.

---

## 2. Staff invitations

### Table

```ts
staffInvites: {
  email: string            // lowercased; the invite is bound to it
  roles: Role[]            // never includes 'athlete'
  token: string            // newToken(), single use
  invitedBy: Id<'users'>
  createdAt: number
  expiresAt: number        // createdAt + 7 days; resend extends it
  lastSentAt: number
  timesSent: number
  acceptedAt?: number
  acceptedBy?: string      // clerkId
  revokedAt?: number
}
  .index('by_token', ['token'])
  .index('by_email', ['email'])
```

### Flow

1. `master_admin` (permission `manage_users`) invites: email + roles.
   - If a `users` row with that email exists → `setRoles` directly (athlete
     keeps `athlete`, gains the invited roles), send the *access granted*
     email, no invite row.
   - Else → insert `staffInvites`, send the *invitation* email.
2. The email links to `/invitacion/$token`. The page shows who invited, for
   which roles, and the invited email, then renders Clerk's `<SignUp>` with
   `initialValues={{ emailAddress }}`, `routing="path"`,
   `path={localizeHref('/invitacion/' + token)}`. No age gate, no pre-signup.
3. `user.created` webhook: `users.create` looks up a pending, unexpired,
   unrevoked invite **by the account's primary email**. Found → roles from
   the invite, `acceptedAt/acceptedBy` set, no birth date needed. Not found →
   `['athlete']` with age undeclared, as today (Google SSO with another
   address ends here; the invite stays pending and `master_admin` can grant
   directly via the existing-account path).
4. Expiry 7 days. Resend issues a new token and extends expiry (5-minute
   brake, same as the guardian email). Revoke sets `revokedAt`.

### Removal

Revoke roles only — `staff.setRoles(userId, [])` for a staff account. The
Clerk account and the `users` row stay: `validatedBy` on registrations keeps
pointing at a real person, and deletion is the person's own LFPDPPP right.
Guards in `convex/lib/staffRules.ts`:

- an actor cannot remove their own `master_admin`;
- the last `master_admin` cannot be removed by anyone.

No email on revocation.

### Emails

Spanish only, from `registro@xuntas.org`, through the existing `template()`
in `convex/emails.ts`:

- **Invitation** — subject `Te invitaron al panel de XUNTAS+XUNTOS`, body
  names the inviter and the roles, one button to the link, "vence en 7 días".
- **Access granted** — subject `Ya tienes acceso al panel de XUNTAS+XUNTOS`,
  button to `/administracion`.

---

## 3. Cycles and the window

### Tables

```ts
cycles: {
  cycle: string        // '2026-2027' — the key the other tables already use
  opensOn: string      // 'yyyy-mm-dd', Mexico City day; window opens 00:00
  closesOn: string     // 'yyyy-mm-dd'; window closes 23:59:59.999
  reviewOn: string     // 'yyyy-mm-dd'; the date promised to registrants
  isActive: boolean    // exactly one true, set explicitly
  createdBy: Id<'users'>
  createdAt: number
  updatedAt: number
}
  .index('by_cycle', ['cycle'])
  .index('by_active', ['isActive'])

cycleChanges: {
  cycle: string
  changedBy: Id<'users'>
  changedAt: number
  before: CycleFields | null      // null on create
  after: CycleFields
}
  .index('by_cycle', ['cycle'])
```

`CycleFields = { opensOn, closesOn, reviewOn, isActive }`.

### Rules (`convex/lib/cycleRules.ts`, pure)

- `windowOf({ opensOn, closesOn })` → `{ opensAtMs, closesAtMs }` using the
  fixed UTC-6 the code already relies on.
- `isWindowOpenFor(cycle, now)`.
- `validateCycle({ cycle, opensOn, closesOn, reviewOn })` → error codes
  `cycle_name_invalid` (`^\d{4}-\d{4}$`, second year = first + 1),
  `cycle_dates_invalid` (closes before opens, or unreadable),
  `cycle_review_before_close`.
- `titleOf(cycle)` → `'Convocatoria General 2026–2027'` / English variant —
  derived, never typed.
- `formatDay(iso, locale)` → `'18 de septiembre de 2026'` / `'September 18, 2026'`.

### "Current cycle"

Exactly one row has `isActive = true`. `cycles.setActive(cycle)` flips it
(one transaction: previous active → false, target → true, one
`cycleChanges` row each). Athletes always register into the active cycle;
`isWindowOpen` reads its dates. Creating next year's row early changes
nothing until someone activates it.

`CURRENT_CYCLE` and the four date constants leave `convex/lib/cycle.ts`.
Every Convex function that used them calls `activeCycle(ctx)`; every client
that used them calls `useQuery(api.cycles.active)`. `ageAt`, `isUnderage`,
`isValidBirthDate` stay where they are.

`cycles.seed` (internal) inserts the 2026–2027 row from the old constants,
run once via CLI in dev and prod **before** the code that reads it deploys.

### The dev hatch

`WINDOW_ALWAYS_OPEN` / `VITE_WINDOW_ALWAYS_OPEN` are deleted — code, vitest
env, `.env.example`, `.env.local`, README, DEPLOYMENT. To test the form
before September, a `master_admin` sets dev dates in `/administracion/convocatorias`.

### Copy

Every string that spells out a date (`account_lede`, `reg_closing`,
`reg_closed`, `done_review`, `done_editable`, `account_closed_text`,
`brand_cycle`, `meta_title`, `meta_description`, `reg_eyebrow`, `bases.tsx`
prose, the three emails) takes the value as a parameter. A window editor that
leaves the landing page saying the old date is worse than no editor.

### Range picker

`src/components/DateField/RangeField.tsx`: one `Calendar` grid; first click
sets `opensOn`, second sets `closesOn`, a third starts over; two typed
`yyyy-mm-dd` boxes beside it stay in sync. `Calendar`/`DayGrid` gain an
optional `rangeEnd` so the days between are tinted (`data-range="start" |
"mid" | "end"`, wash background, no new colours). `reviewOn` is a plain
`DateField` under it with `min={closesOn}`.

### Who edits

Permission `manage_cycles` (master_admin). Every create/update/setActive
writes a `cycleChanges` row.

---

## 4. Screens and landing

Routes are Spanish slugs under the locale prefix, like the rest:

| route | who | what |
|---|---|---|
| `/administracion` | any staff | layout: guard, cycle selector, sub-nav; index redirects to `registros` if `review_registrations`, else renders the placeholder |
| `/administracion/registros` | `review_registrations` | the three views |
| `/administracion/registros/$id` | `review_registrations` | detail + decision panel |
| `/administracion/equipo` | `view_staff` | staff + pending invites; editable with `manage_users` |
| `/administracion/convocatorias` | `manage_cycles` | cycle list, create, edit, set active |
| `/invitacion/$token` (+ `/$`) | public | invite landing + Clerk sign-up |

Landing after sign-in: Clerk still redirects to `/mi-registro`;
`RegistrationPanel` renders `<Navigate to="/administracion" />` when the
account lacks `athlete`. `/administracion` for a role with no permissions
shows "no tools for your role yet" (`admin_no_tools_*` messages).

The header's `AccountNav` shows "Administración" beside "Mi registro" for
staff, driven by `users.me` (`{ roles, permissions }`).

All admin copy is bilingual through Paraglide, like everything else.

---

## 5. Registrations review

### Data added to `registrations`

```ts
status: 'draft' | 'submitted' | 'validated' | 'rejected' | 'selected' | 'not_selected'
wasMinorAtCycleStart?: boolean        // §7
decisionLog?: Array<{ status: Decision; by: Id<'users'>; at: number; note?: string }>
decisionNotice?: {
  decision: 'rejected' | 'selected' | 'not_selected'
  status: 'not_sent' | 'sent' | 'delivered' | 'bounced'
  emailId?: string
  sentAt?: number
  sentBy?: Id<'users'>
}
```

`validatedBy/validatedAt/validationNote` stay as "the latest decision";
`decisionLog` is the trail. New index `by_notice_email` on
`['decisionNotice.emailId']` so the Resend webhook can find the row.

### Transitions (`convex/lib/decisionRules.ts`, pure)

```
submitted → validated | rejected        review_registrations
validated → selected | not_selected     select_registrations
any decided → any other decided         same permission as the target, note required
```

- `draft` is never decided.
- `rejected`, `validated`, `selected`, `not_selected` may be changed; the
  mutation appends to `decisionLog` and a **note is required** on every
  rejection, on any change within a stage, on any reversal back to an earlier
  stage, and whenever an email has already been sent — but not on the forward
  move from screening to selection (`validated → selected` / `validated → not_selected`),
  which is the next stage rather than a change of mind.
- **Guardian:** a submitted registration whose guardian has not confirmed may
  be `validated` (it stays flagged) but may **not** be `selected`
  (`guardian_unconfirmed`). This closes DECISIONS open item 2.
- **Lock:** once `decisionNotice.status !== 'not_sent'`, changing the decision
  requires `select_registrations` (master_admin) and a note, and resets
  `decisionNotice` to `{ decision: <new>, status: 'not_sent' }`. Never
  auto-resends.

### Sections complete

`sectionsComplete(data): number` in `decisionRules.ts` counts the seven
*required* steps whose rules pass: personal, academic, athletic, results,
rankings, letter, confirmations. Calendar is optional and excluded — the
measure exists to find people who still owe something. Computed on the server
in `listForAdmin` so the table sorts on it.

### `registrations.listForAdmin({ cycle })`

Returns one row per registration in the cycle:

```ts
{
  _id, status, submittedAt, updatedAt,
  name, email, branch, state, isMinor,
  guardianRequired, guardianConfirmed,
  sectionsComplete,            // 0..7
  notice: decisionNotice?.status ?? null,
  decision: decisionNotice?.decision ?? null,
}
```

Filtering, sorting and selection happen client-side (hundreds of rows).

### `registrations.detail({ id })`

The full document plus the athlete's account axis (`emailVerified`,
`birthDate`, `wasMinorAtSignup`), the guardian row, and `decisionLog` with
names resolved.

### Table UI (`@tanstack/react-table` v9)

Three views as tabs over one query, each a preset of filters:

1. **Pendientes** — `status = submitted`, guardian-pending rows flagged.
2. **Todos** — everything, filters: status, branch, guardian, sections
   complete (`≥ n`), notice.
3. **Incompletos** — `status = draft`, sorted by `sectionsComplete` ascending,
   for chasing before the close.

Row selection (checkboxes) only in *Todos* and only with `send_batch`.
Columns: name, branch, status chip, sections `n/7`, guardian chip, notice
chip, submitted date. Clicking a row opens the detail.

### Detail UI

Single page, all eight sections stacked, letter in full, results/rankings/
calendar as small tables; decision panel pinned on the side (sticky on
desktop, below on mobile): current status, guardian state, notice state,
buttons per permission, note field, log.

---

## 6. Decision emails

Three Spanish copies through `template()`, drafted for XUNTAS approval:

| decision | subject | when | who |
|---|---|---|---|
| `rejected` | `Sobre tu registro · Convocatoria {cycle}` | individually, any time | `send_rejection` |
| `selected` | `Fuiste seleccionad@ · Programa de Desarrollo` | batch, after close | `send_batch` |
| `not_selected` | `Sobre tu registro · Convocatoria {cycle}` | batch, after close | `send_batch` |

No internal note ever enters a body. Bodies go to the **account** email
(`users.email`), never the form's.

`notices.sendRejection({ id })`, `notices.sendBatch({ cycle, ids })`,
`notices.sendTest({ decision })` (to the actor's own address). The batch
refuses while the active window is open (`window_open`), skips rows whose
notice is not `not_sent`, and returns `{ sent, skipped }`. The UI: row
selection → confirm dialog with the count → send; a "send test to me" button
beside it.

`decisionNotice.status` moves `sent → delivered | bounced` from the existing
`recordEmailEvent`, by `emailId`.

---

## 7. Athlete side

- `users.myStatus` gains `decision: { status, decision } | null` — non-null
  only when `decisionNotice.status !== 'not_sent'`. `AccountStatus` renders
  the chip from it. Panel and email always agree.
- Returning athletes: `registrations.mine` returns `previous` (personal,
  academic, athletic of the most recent other-cycle registration) when there
  is no registration in the active cycle. The panel seeds
  `emptyRegistration` from it; results, rankings, calendar, letter and
  confirmations start empty.
- **Minor status per cycle.** On the first write of a registration in a
  cycle, `wasMinorAtCycleStart = isUnderage(user.birthDate, opensAtMs)` is
  stored on the registration. If true and no `guardianAuth` exists for
  `(user, cycle)`, one is opened by copying name/email from the user's most
  recent `guardianAuth`. `users.wasMinorAtSignup` is never rewritten.

---

## 8. Out of scope

CSV export; screens for coach/finance/health; archiving cycles; changing the
Clerk sign-in fallback URL (build arg — not worth a rebuild).

---

## 9. Rollout order

1. **Roles and invitations** — schema transition + backfill + bootstrap +
   invite flow + `/administracion/equipo`. After this the person named above
   is `master_admin` in prod.
2. **Cycles and window** — `cycles` seed, constants removed, copy
   interpolated, hatch deleted, `/administracion/convocatorias`.
3. **Admin review** — statuses, decision rules, table, detail, emails,
   notices.
4. **Athlete decisions and returning** — chip, `previous`, per-cycle minor.

Each branch leaves `npm run check` green and is a separate PR to `main`.
Convex deploys **before** the container on every hop (README, CI/CD).
