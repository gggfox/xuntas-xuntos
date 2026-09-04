# Roles and Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Clerk-owned `users.role` enum with a Convex-owned `roles` array behind a permission table, and let a `master_admin` invite, edit and revoke staff from `/administracion/equipo`.

**Architecture:** Roles live on `users.roles` and are only ever written by three Convex paths (CLI bootstrap, invite acceptance in the webhook, `staff.setRoles`). Every guard reads a *permission* from `convex/lib/permissions.ts`, never a role. Invitations are a `staffInvites` table bound to an email, sent through the existing Resend template, and redeemed by the `user.created` webhook matching the account's primary email. The schema moves in two deploys with a backfill between them because prod has rows.

**Tech Stack:** Convex 1.45, Clerk (`@clerk/tanstack-react-start`), TanStack Start/Router 1.x, React 19, Paraglide 2.24, `@tanstack/react-table` 9.x, Vitest 3.2.

**Spec:** [`docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md`](../specs/2026-09-03-admin-roles-cycles-review-design.md) §1, §2, §4. Read it first.

## Global Constraints

- **Branch:** `feat/roles-and-invitations`, cut from `main`. One PR. `npm run check` green before every commit.
- **Rules modules import nothing** from `convex/_generated`, `convex/values`, or Paraglide. They run in a plain Node vitest (`tests/*.test.ts`). Precedent: `convex/lib/cycle.ts`, `convex/lib/registrationRules.ts`.
- **Convex thrown errors** are `ConvexError({ code })` with a code from `convex/lib/errorCodes.ts`. Never `new Error(prose)`. Every new code gets a message in **both** `messages/es.json` and `messages/en.json` and an entry in the `MESSAGES` map of `src/lib/registrationErrors.ts` (it is `Record<AppErrorCode, …>`, so typecheck fails otherwise).
- **All user-facing strings** go through Paraglide. Both message files must hold identical key sets.
- **Emails are Spanish only**, from `XUNTAS+XUNTOS <registro@xuntas.org>`, through `template()` in `convex/emails.ts`. Anything user-typed that lands in HTML goes through `textForEmail`.
- **Design rules** (`docs/BRAND.md`): no shadows, one solid-yellow element per screen, yellow always with an ink border, mono small caps for labels/chips, semantic colours for state only. Reuse `.btn`, `.btn-ghost`, `.chip*`, `.card`, `.fld-input`, `.eyebrow`, `.h-display`, `.col`.
- **Comments** follow the repo's voice: say *why*, in full sentences, above the thing.
- **Schema transition order matters.** Task 3 deploys with `roles` optional; Task 4's backfill runs in dev and `--prod`; only then Task 5 makes `roles` required. Do not merge Tasks 3–5 into one deploy.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

---

## File structure

| File | Responsibility |
|---|---|
| `convex/lib/permissions.ts` | The role and permission unions and the one table mapping them. Pure. |
| `convex/lib/staffRules.ts` | Invite validation, invite status, and the two lock-out guards. Pure. |
| `convex/schema.ts` | `vRole` widened, `users.roles`, `staffInvites`. |
| `convex/users.ts` | `requirePermission`, `me`, `backfillRoles`; `create` redeems invites; `update` stops mirroring role. |
| `convex/staff.ts` | `grantRoles`, `invite`, `resendInvite`, `revokeInvite`, `setRoles`, `list`, `getInvite`. |
| `convex/emails.ts` | `sendStaffInvitation`, `sendAccessGranted`. |
| `convex/http.ts` | Drops `role()`. |
| `convex/registrations.ts` | `requireAdmin` → `requirePermission('review_registrations')`. |
| `convex/lib/errorCodes.ts` | New action codes. |
| `src/lib/registrationErrors.ts` | Messages for the new codes. |
| `src/lib/permissions.ts` | Re-export shim of the backend module. |
| `src/hooks/useMe.ts` | `useQuery(api.users.me)`. |
| `src/components/AppBar/AccountNav.tsx` | "Administración" link for staff. |
| `src/components/MyRegistration/RegistrationPanel.tsx` | Non-athletes go to `/administracion`. |
| `src/routes/administracion.tsx` | Layout: guard + sub-nav. |
| `src/routes/administracion.index.tsx` | Redirect or placeholder. |
| `src/routes/administracion.equipo.tsx` | Staff page. |
| `src/routes/invitacion.$token.tsx`, `src/routes/invitacion.$token.$.tsx` | Invite landing + Clerk sign-up. |
| `src/components/Admin/AdminShell.tsx` | The band under the header: title, sub-nav. |
| `src/components/Admin/NoTools.tsx` | Placeholder for roles without screens. |
| `src/components/Admin/StaffTable.tsx` | TanStack table of staff + invites. |
| `src/components/Admin/RoleChecks.tsx` | The six role checkboxes, reused by invite form and row editor. |
| `src/components/Admin/InviteForm.tsx` | Email + roles → `staff.invite`. |
| `src/components/InviteScreen.tsx` | `/invitacion/$token` body. |
| `tests/permissions.test.ts`, `tests/staffRules.test.ts`, `tests/components/StaffTable.test.tsx`, `tests/components/InviteScreen.test.tsx` | Tests. |
| `docs/DECISIONS.md`, `README.md`, `docs/DEPLOYMENT.md` | Amended. |

---

### Task 1: Permissions module

**Files:**
- Create: `convex/lib/permissions.ts`
- Create: `src/lib/permissions.ts`
- Test: `tests/permissions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `const ROLES: readonly ['athlete','admin','master_admin','coach','finance','health']`
  - `type Role`
  - `const PERMISSIONS: readonly ['review_registrations','send_rejection','select_registrations','send_batch','view_staff','manage_users','manage_cycles']`
  - `type Permission`
  - `function isRole(value: unknown): value is Role`
  - `function can(roles: readonly Role[], permission: Permission): boolean`
  - `function permissionsOf(roles: readonly Role[]): Permission[]`
  - `function isStaff(roles: readonly Role[]): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/permissions.test.ts
import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  ROLES,
  can,
  isRole,
  isStaff,
  permissionsOf,
} from '../convex/lib/permissions'

describe('the permission table', () => {
  it('gives admin the review permissions and nothing that manages people or dates', () => {
    expect(can(['admin'], 'review_registrations')).toBe(true)
    expect(can(['admin'], 'send_rejection')).toBe(true)
    expect(can(['admin'], 'view_staff')).toBe(true)
    expect(can(['admin'], 'select_registrations')).toBe(false)
    expect(can(['admin'], 'send_batch')).toBe(false)
    expect(can(['admin'], 'manage_users')).toBe(false)
    expect(can(['admin'], 'manage_cycles')).toBe(false)
  })

  /** "Complete access to everything": a missing checkbox must never lock a master_admin out. */
  it('makes master_admin a superset of every permission', () => {
    for (const p of PERMISSIONS) expect(can(['master_admin'], p)).toBe(true)
  })

  it('grants nothing to athletes and to the roles without screens yet', () => {
    for (const role of ['athlete', 'coach', 'finance', 'health'] as const) {
      expect(permissionsOf([role])).toEqual([])
    }
  })

  it('unions permissions across roles', () => {
    expect(permissionsOf(['athlete', 'admin'])).toEqual(permissionsOf(['admin']))
  })

  it('lists permissions in table order, without duplicates', () => {
    expect(permissionsOf(['admin', 'master_admin'])).toEqual([...PERMISSIONS])
  })
})

describe('isStaff', () => {
  it('is anyone with a role other than athlete', () => {
    expect(isStaff(['athlete'])).toBe(false)
    expect(isStaff([])).toBe(false)
    expect(isStaff(['coach'])).toBe(true)
    expect(isStaff(['athlete', 'admin'])).toBe(true)
  })
})

describe('isRole', () => {
  it('accepts only the six roles', () => {
    for (const r of ROLES) expect(isRole(r)).toBe(true)
    expect(isRole('superuser')).toBe(false)
    expect(isRole(1)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/permissions.test.ts`
Expected: FAIL — cannot resolve `../convex/lib/permissions`.

- [ ] **Step 3: Write the module**

```ts
// convex/lib/permissions.ts
/**
 * Who may do what. The only place a role is compared to anything.
 *
 * Guards read a PERMISSION, never a role: `requirePermission(ctx,
 * 'manage_cycles')` rather than `user.roles.includes('master_admin')`. When
 * finance needs the cycle screen next year, that is one entry in `GRANTS`
 * and no guard changes.
 *
 * Pure on purpose — it runs in the browser (to decide what to draw) and in
 * Convex (to decide what to allow), and it must not be able to disagree.
 */

export const ROLES = ['athlete', 'admin', 'master_admin', 'coach', 'finance', 'health'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  'review_registrations',
  'send_rejection',
  'select_registrations',
  'send_batch',
  'view_staff',
  'manage_users',
  'manage_cycles',
] as const
export type Permission = (typeof PERMISSIONS)[number]

/**
 * `master_admin` is listed with everything rather than special-cased in
 * `can`: "complete access" is a fact of the table, and a reader of the
 * table should see it there.
 */
const GRANTS: Record<Role, readonly Permission[]> = {
  athlete: [],
  admin: ['review_registrations', 'send_rejection', 'view_staff'],
  master_admin: PERMISSIONS,
  coach: [],
  finance: [],
  health: [],
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function can(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => GRANTS[r].includes(permission))
}

/** In table order, so two lists compare with `toEqual`. */
export function permissionsOf(roles: readonly Role[]): Permission[] {
  return PERMISSIONS.filter((p) => can(roles, p))
}

/** Anyone with a role that is not `athlete`. Decides which header to draw. */
export function isStaff(roles: readonly Role[]): boolean {
  return roles.some((r) => r !== 'athlete')
}
```

```ts
// src/lib/permissions.ts
/**
 * Re-exports the permission table from the backend, the way `cycle.ts` and
 * `registrationRules.ts` do: the browser decides what to draw from the same
 * table Convex decides what to allow from.
 */
export {
  PERMISSIONS,
  ROLES,
  can,
  isRole,
  isStaff,
  permissionsOf,
  type Permission,
  type Role,
} from '../../convex/lib/permissions'
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/permissions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/permissions.ts src/lib/permissions.ts tests/permissions.test.ts
git commit -m "feat(roles): permission table shared by client and server

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Staff rules module

**Files:**
- Create: `convex/lib/staffRules.ts`
- Modify: `convex/lib/errorCodes.ts`
- Test: `tests/staffRules.test.ts`

**Interfaces:**
- Consumes: `Role`, `isRole` from Task 1; `isValidEmail` from `convex/lib/html.ts`.
- Produces:
  - `const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000`
  - `const INVITE_RESEND_WAIT_MS = 5 * 60 * 1000`
  - `type StaffRole = Exclude<Role, 'athlete'>`
  - `function normalizeStaffRoles(roles: readonly unknown[]): StaffRole[]` — dedupes, drops `athlete` and unknowns, keeps `ROLES` order.
  - `function validateInvite(input: { email: string; roles: readonly unknown[] }): AppErrorCode | null` — `invite_email_invalid` | `invite_roles_invalid` | null.
  - `type InviteStatus = 'pending' | 'expired' | 'accepted' | 'revoked'`
  - `function inviteStatus(invite: { expiresAt: number; acceptedAt?: number; revokedAt?: number }, now: number): InviteStatus`
  - `function checkRoleChange(input: { actorId: string; actorRoles: readonly Role[]; targetId: string; targetRoles: readonly Role[]; nextRoles: readonly Role[]; masterAdminCount: number }): AppErrorCode | null` — `cannot_remove_own_master_admin` | `cannot_remove_last_master_admin` | null.
- New error codes in `ActionErrorCode`: `permission_required`, `invite_email_invalid`, `invite_roles_invalid`, `invite_invalid`, `invite_expired`, `invite_revoked`, `invite_accepted`, `invite_wait`, `cannot_remove_own_master_admin`, `cannot_remove_last_master_admin`, `user_not_found`.

- [ ] **Step 1: Add the error codes**

In `convex/lib/errorCodes.ts`, replace the `ActionErrorCode` union with:

```ts
/** A rejection of the whole action, thrown rather than returned. */
export type ActionErrorCode =
  | 'window_closed'
  | 'already_reviewed'
  | 'birth_date_missing'
  | 'birth_date_locked'
  | 'not_signed_in'
  | 'permission_required'
  | 'guardian_not_required'
  | 'guardian_already_confirmed'
  | 'field_too_long'
  | 'too_many_rows'
  | 'letter_too_long'
  // Staff and invitations.
  | 'invite_email_invalid'
  | 'invite_roles_invalid'
  | 'invite_invalid'
  | 'invite_expired'
  | 'invite_revoked'
  | 'invite_accepted'
  | 'invite_wait'
  | 'cannot_remove_own_master_admin'
  | 'cannot_remove_last_master_admin'
  | 'user_not_found'
  /** Nothing more specific survived the trip. Renders as `err_generic`. */
  | 'generic'
```

(`admin_required` is gone. Typecheck will point at every place that must move to `permission_required` — those are Tasks 5 and 6.)

- [ ] **Step 2: Write the failing tests**

```ts
// tests/staffRules.test.ts
import { describe, expect, it } from 'vitest'
import {
  INVITE_TTL_MS,
  checkRoleChange,
  inviteStatus,
  normalizeStaffRoles,
  validateInvite,
} from '../convex/lib/staffRules'

const NOW = Date.parse('2026-09-03T18:00:00.000Z')

describe('normalizeStaffRoles', () => {
  it('drops athlete, unknowns and duplicates, and keeps table order', () => {
    expect(normalizeStaffRoles(['coach', 'athlete', 'admin', 'coach', 'god'])).toEqual([
      'admin',
      'coach',
    ])
  })
})

describe('validateInvite', () => {
  it('accepts an email and at least one staff role', () => {
    expect(validateInvite({ email: 'ana@xuntas.org', roles: ['admin'] })).toBeNull()
  })

  it('rejects a bad email', () => {
    expect(validateInvite({ email: 'ana', roles: ['admin'] })).toBe('invite_email_invalid')
  })

  /** An invite for "athlete" is a sign-up link, not an invitation. */
  it('rejects roles that leave nothing staff-like', () => {
    expect(validateInvite({ email: 'ana@xuntas.org', roles: [] })).toBe('invite_roles_invalid')
    expect(validateInvite({ email: 'ana@xuntas.org', roles: ['athlete'] })).toBe(
      'invite_roles_invalid',
    )
  })
})

describe('inviteStatus', () => {
  const base = { expiresAt: NOW + INVITE_TTL_MS }

  it('is pending until it expires', () => {
    expect(inviteStatus(base, NOW)).toBe('pending')
    expect(inviteStatus(base, NOW + INVITE_TTL_MS + 1)).toBe('expired')
  })

  it('reports accepted and revoked ahead of expiry', () => {
    expect(inviteStatus({ ...base, acceptedAt: NOW }, NOW + INVITE_TTL_MS + 1)).toBe('accepted')
    expect(inviteStatus({ ...base, revokedAt: NOW }, NOW)).toBe('revoked')
  })
})

describe('checkRoleChange', () => {
  const me = { actorId: 'u1', actorRoles: ['master_admin'] as const }

  it('lets a master_admin change someone else freely', () => {
    expect(
      checkRoleChange({
        ...me,
        targetId: 'u2',
        targetRoles: ['admin'],
        nextRoles: ['admin', 'coach'],
        masterAdminCount: 1,
      }),
    ).toBeNull()
  })

  it('refuses to remove your own master_admin', () => {
    expect(
      checkRoleChange({
        ...me,
        targetId: 'u1',
        targetRoles: ['master_admin'],
        nextRoles: ['admin'],
        masterAdminCount: 3,
      }),
    ).toBe('cannot_remove_own_master_admin')
  })

  it('refuses to remove the last master_admin, whoever they are', () => {
    expect(
      checkRoleChange({
        ...me,
        targetId: 'u2',
        targetRoles: ['master_admin'],
        nextRoles: [],
        masterAdminCount: 1,
      }),
    ).toBe('cannot_remove_last_master_admin')
  })

  it('allows removing a master_admin when another remains', () => {
    expect(
      checkRoleChange({
        ...me,
        targetId: 'u2',
        targetRoles: ['master_admin'],
        nextRoles: ['admin'],
        masterAdminCount: 2,
      }),
    ).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/staffRules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the module**

```ts
// convex/lib/staffRules.ts
import type { AppErrorCode } from './errorCodes'
import { isValidEmail } from './html'
import { ROLES, isRole, type Role } from './permissions'

/**
 * The rules of inviting and removing staff, as pure functions returning
 * codes. `convex/staff.ts` calls them before writing; the invite form calls
 * them for immediate feedback.
 */

/** Seven days. Long enough to be read on a Monday and acted on Friday. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Same brake as the guardian email: this is a way to make the domain send mail. */
export const INVITE_RESEND_WAIT_MS = 5 * 60 * 1000

export type StaffRole = Exclude<Role, 'athlete'>

/** Dedupes, drops `athlete` and anything unknown, keeps table order. */
export function normalizeStaffRoles(roles: readonly unknown[]): StaffRole[] {
  const wanted = new Set(roles.filter(isRole))
  return ROLES.filter((r): r is StaffRole => r !== 'athlete' && wanted.has(r))
}

export function validateInvite(input: {
  email: string
  roles: readonly unknown[]
}): AppErrorCode | null {
  if (!isValidEmail(input.email.trim().toLowerCase())) return 'invite_email_invalid'
  if (normalizeStaffRoles(input.roles).length === 0) return 'invite_roles_invalid'
  return null
}

export type InviteStatus = 'pending' | 'expired' | 'accepted' | 'revoked'

/** Accepted and revoked outrank expiry: they are things people did. */
export function inviteStatus(
  invite: { expiresAt: number; acceptedAt?: number; revokedAt?: number },
  now: number,
): InviteStatus {
  if (invite.acceptedAt !== undefined) return 'accepted'
  if (invite.revokedAt !== undefined) return 'revoked'
  if (now > invite.expiresAt) return 'expired'
  return 'pending'
}

/**
 * The two ways to lock XUNTAS out of its own panel, refused here.
 *
 * `masterAdminCount` is how many accounts hold `master_admin` BEFORE the
 * change, the target included.
 */
export function checkRoleChange(input: {
  actorId: string
  actorRoles: readonly Role[]
  targetId: string
  targetRoles: readonly Role[]
  nextRoles: readonly Role[]
  masterAdminCount: number
}): AppErrorCode | null {
  const losesMaster =
    input.targetRoles.includes('master_admin') && !input.nextRoles.includes('master_admin')
  if (!losesMaster) return null
  if (input.targetId === input.actorId) return 'cannot_remove_own_master_admin'
  if (input.masterAdminCount <= 1) return 'cannot_remove_last_master_admin'
  return null
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/staffRules.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add convex/lib/staffRules.ts convex/lib/errorCodes.ts tests/staffRules.test.ts
git commit -m "feat(roles): staff invitation and role-change rules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Typecheck is red until Task 5 finishes moving `admin_required`. That is expected between these two commits; do not stub it.)

---

### Task 3: Schema step 1 — `roles` optional beside `role`, plus `staffInvites`

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/users.ts` (`create`, `update`)

**Interfaces:**
- Produces: `vRole` = union of the six roles; `users.roles?: Role[]`; `staffInvites` table as in spec §2.
- `users.create` still takes `role` (Clerk) for this deploy and writes both `role` and `roles`.

- [ ] **Step 1: Widen `vRole` and add `roles` (optional) and `staffInvites`**

In `convex/schema.ts`:

```ts
import { ROLES } from './lib/permissions'

/**
 * Account roles. Owned by Convex — see docs/DECISIONS.md, "Convex owns roles".
 * `role` (singular, Clerk-mirrored) is on its way out: this deploy adds
 * `roles`, the backfill fills it, the next deploy drops `role`.
 */
export const vRole = v.union(...ROLES.map((r) => v.literal(r)))
```

(`v.union` needs at least two literals; spreading a six-element tuple satisfies TypeScript as `v.union(v.literal('athlete'), v.literal('admin'), …)` — if the spread does not typecheck against Convex's overloads, write the six `v.literal` calls out by hand.)

In the `users` table, keep `role: vRole,` and add directly beneath it:

```ts
    /**
     * The roles that count. Optional only for the length of the backfill;
     * `users.backfillRoles` fills it from `role`, and the next schema step
     * makes it required.
     */
    roles: v.optional(v.array(vRole)),
```

After `preSignups`, add:

```ts
  /**
   * Staff invitations. Bound to an email: the webhook redeems one by matching
   * the account's primary address, so a forwarded link is worth nothing to
   * anyone else. `token` only names the page the invitee lands on.
   */
  staffInvites: defineTable({
    email: v.string(),
    roles: v.array(vRole),
    token: v.string(),
    invitedBy: v.id('users'),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastSentAt: v.number(),
    timesSent: v.number(),
    acceptedAt: v.optional(v.number()),
    /** clerkId of the account that redeemed it. */
    acceptedBy: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index('by_token', ['token'])
    .index('by_email', ['email']),
```

- [ ] **Step 2: Write `roles` on create and update, still from `role`**

In `convex/users.ts` `create`, in the `existing` branch patch and in the insert, add `roles: [args.role],` beside `role: args.role,`. In `update`, add `roles: [args.role],` to the patch. This keeps this deploy self-consistent for new rows; existing rows are the backfill's job.

- [ ] **Step 3: Typecheck the Convex side only**

Run: `npx convex dev --once`
Expected: schema accepted, functions pushed. (`npm run typecheck` is still red from Task 2's `admin_required` removal — fine.)

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/users.ts
git commit -m "feat(roles): add users.roles (optional) and staffInvites table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Backfill

**Files:**
- Modify: `convex/users.ts`

**Interfaces:**
- Produces: `users.backfillRoles` internal mutation, idempotent, returns `{ updated: number }`.

- [ ] **Step 1: Write the mutation**

Append to `convex/users.ts`:

```ts
/**
 * One-off: `roles` from `role`. Idempotent — rows that already carry `roles`
 * are skipped — so it can be re-run if it is interrupted. Run by hand:
 *
 *   npx convex run users:backfillRoles
 *   npx convex run users:backfillRoles --prod
 *
 * Deleted in the schema step that drops `role`.
 */
export const backfillRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect()
    let updated = 0
    for (const u of users) {
      if (u.roles !== undefined) continue
      await ctx.db.patch(u._id, { roles: [u.role] })
      updated++
    }
    console.log(`[users.backfillRoles] ${updated} of ${users.length} rows updated`)
    return { updated }
  },
})
```

- [ ] **Step 2: Run it in dev and verify**

```bash
npx convex run users:backfillRoles
```

Expected: `{ updated: N }` where N is the number of rows without `roles`. Run again: `{ updated: 0 }`.

- [ ] **Step 3: Run it in prod**

```bash
npx convex deploy
npx convex run users:backfillRoles --prod
```

Expected: `{ updated: N }`. Confirm in the prod dashboard that every `users` row has `roles`.

- [ ] **Step 4: Commit**

```bash
git add convex/users.ts
git commit -m "feat(roles): backfill users.roles from role

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Schema step 2 — `roles` required, `role` gone, permissions enforced

**Files:**
- Modify: `convex/schema.ts`, `convex/users.ts`, `convex/http.ts`, `convex/registrations.ts`
- Modify: `src/lib/registrationErrors.ts`, `messages/es.json`, `messages/en.json`

**Interfaces:**
- Produces:
  - `users.roles: Role[]` (required); no `role`.
  - `async function requirePermission(ctx: QueryCtx, permission: Permission): Promise<Doc<'users'>>` — throws `not_signed_in` or `permission_required`.
  - `users.me` query → `{ roles: Role[]; permissions: Permission[] } | null`.
  - `users.create` args drop `role`; add nothing (invite redemption is Task 7).
  - `users.update` args drop `role`.
  - `myStatus.account.roles: Role[]` replaces `.role`.

- [ ] **Step 1: Schema**

In `convex/schema.ts` `users`: delete the `role: vRole,` line and the transition comment; make it `roles: v.array(vRole),` with the comment:

```ts
    /**
     * Owned by Convex, never by Clerk. Written by exactly three paths:
     * `staff.grantRoles` (CLI bootstrap), the invite redeemed in
     * `users.create`, and `staff.setRoles`. See convex/lib/permissions.ts
     * for what each role may do.
     */
    roles: v.array(vRole),
```

Replace `.index('by_role', ['role'])` with nothing (drop it).

- [ ] **Step 2: `users.ts`**

Remove `backfillRoles`. Replace `requireAdmin` with:

```ts
import { can, permissionsOf, type Permission } from './lib/permissions'

export async function requirePermission(
  ctx: QueryCtx,
  permission: Permission,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (!can(user.roles, permission)) fail('permission_required')
  return user
}
```

In `create`: remove `role: vRole` from args; in the `existing` patch remove `role`/`roles` lines (an existing row keeps its roles — a re-delivered webhook must not reset a master_admin to athlete); in the insert write `roles: ['athlete'],`. Remove the `vRole` import if unused.

In `update`: remove `role` from args and from the patch.

In `myStatus`, replace `role: user.role,` with `roles: user.roles,`.

Add:

```ts
/**
 * Roles and permissions for the header and the admin guard. Separate from
 * `myStatus` for the same reason `myThemePreference` is: that query serves
 * the registration panel, and the header runs on every page.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null
    return { roles: user.roles, permissions: permissionsOf(user.roles) }
  },
})
```

- [ ] **Step 3: `http.ts`**

Delete the `role()` function and the `role: role(event.data),` lines in both `user.created` and `user.updated`. Update the `ClerkEvent` type comment on `public_metadata` — it is still received, just unread:

```ts
    /** Unread since roles moved to Convex; kept in the type so a future reader knows it arrives. */
    public_metadata?: Record<string, unknown> | null
```

- [ ] **Step 4: `registrations.ts`**

Replace the `requireAdmin` import with `requirePermission`, and both calls:

```ts
    await requirePermission(ctx, 'review_registrations')
```

(`review` keeps `const admin = await requirePermission(ctx, 'review_registrations')`.)

- [ ] **Step 5: Messages and the errors map**

`messages/es.json` — remove `err_admin_required`, add:

```json
  "err_permission_required": "Tu cuenta no tiene permiso para hacer esto.",
  "err_invite_email_invalid": "Escribe un correo válido.",
  "err_invite_roles_invalid": "Elige al menos un rol.",
  "err_invite_invalid": "Esta invitación no existe.",
  "err_invite_expired": "Esta invitación venció. Pide que te la reenvíen.",
  "err_invite_revoked": "Esta invitación fue cancelada.",
  "err_invite_accepted": "Esta invitación ya fue usada.",
  "err_invite_wait": "Espera unos minutos antes de reenviar.",
  "err_cannot_remove_own_master_admin": "No puedes quitarte a ti mismo el rol de administración maestra.",
  "err_cannot_remove_last_master_admin": "Alguien tiene que conservar la administración maestra.",
  "err_user_not_found": "No encontramos esa cuenta.",
```

`messages/en.json` — remove `err_admin_required`, add:

```json
  "err_permission_required": "Your account doesn't have permission to do this.",
  "err_invite_email_invalid": "Enter a valid email.",
  "err_invite_roles_invalid": "Pick at least one role.",
  "err_invite_invalid": "This invitation doesn't exist.",
  "err_invite_expired": "This invitation expired. Ask for it to be resent.",
  "err_invite_revoked": "This invitation was cancelled.",
  "err_invite_accepted": "This invitation was already used.",
  "err_invite_wait": "Wait a few minutes before resending.",
  "err_cannot_remove_own_master_admin": "You can't remove your own master admin role.",
  "err_cannot_remove_last_master_admin": "Someone has to keep the master admin role.",
  "err_user_not_found": "We couldn't find that account.",
```

`src/lib/registrationErrors.ts` — in `MESSAGES`, replace `admin_required: m.err_admin_required,` with:

```ts
  permission_required: m.err_permission_required,
  invite_email_invalid: m.err_invite_email_invalid,
  invite_roles_invalid: m.err_invite_roles_invalid,
  invite_invalid: m.err_invite_invalid,
  invite_expired: m.err_invite_expired,
  invite_revoked: m.err_invite_revoked,
  invite_accepted: m.err_invite_accepted,
  invite_wait: m.err_invite_wait,
  cannot_remove_own_master_admin: m.err_cannot_remove_own_master_admin,
  cannot_remove_last_master_admin: m.err_cannot_remove_last_master_admin,
  user_not_found: m.err_user_not_found,
```

- [ ] **Step 6: Check, deploy, verify**

Run: `npm run check`
Expected: green.

Run: `npx convex dev --once` then `npx convex deploy`
Expected: schema accepted in both (every row has `roles`, per Task 4).

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/users.ts convex/http.ts convex/registrations.ts src/lib/registrationErrors.ts messages/es.json messages/en.json
git commit -m "feat(roles): roles required, role dropped, guards read permissions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Invitation and access emails

**Files:**
- Modify: `convex/emails.ts`

**Interfaces:**
- Consumes: `template`, `button`, `appUrl`, `textForEmail`.
- Produces:
  - `emails.sendStaffInvitation` internal mutation `{ to, inviterName, roles: string[], token }`
  - `emails.sendAccessGranted` internal mutation `{ to, roles: string[] }`

- [ ] **Step 1: Add a role-name helper and the two mutations**

Append to `convex/emails.ts`:

```ts
/**
 * Role names for the two staff emails. Spanish, like the rest of the mail;
 * the panel itself is bilingual, but every email this system sends is in the
 * language the organisation writes in.
 */
const ROLE_NAMES_ES: Record<string, string> = {
  admin: 'Administración',
  master_admin: 'Administración maestra',
  coach: 'Coach',
  finance: 'Finanzas',
  health: 'Salud',
}

function roleList(roles: string[]): string {
  return roles.map((r) => textForEmail(ROLE_NAMES_ES[r] ?? r)).join(', ')
}

export const sendStaffInvitation = internalMutation({
  args: {
    to: v.string(),
    inviterName: v.string(),
    roles: v.array(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const href = `${appUrl()}/es/invitacion/${encodeURIComponent(args.token)}`
    const inviter = textForEmail(args.inviterName)

    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject: 'Te invitaron al panel de XUNTAS+XUNTOS',
      html: template(
        `<p style="margin:0 0 14px;">Hola:</p>
         <p style="margin:0 0 14px;">
           <b>${inviter}</b> te invitó al panel de XUNTAS+XUNTOS con el rol de
           <b>${roleList(args.roles)}</b>.
         </p>
         <p style="margin:0 0 14px;">
           Crea tu cuenta con este mismo correo. No hay contraseña: entras con Google
           o con un código que te llega por correo.
         </p>
         ${button(href, 'Crear mi cuenta')}
         <p style="margin:0 0 14px;font-size:13px;color:rgba(17,17,17,.58);">
           La invitación vence en 7 días. Si no esperabas este correo, ignóralo.
         </p>`,
        'Te invitaron al panel de XUNTAS+XUNTOS.',
      ),
    })
  },
})

export const sendAccessGranted = internalMutation({
  args: { to: v.string(), roles: v.array(v.string()) },
  handler: async (ctx, args) => {
    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject: 'Ya tienes acceso al panel de XUNTAS+XUNTOS',
      html: template(
        `<p style="margin:0 0 14px;">Hola:</p>
         <p style="margin:0 0 14px;">
           Tu cuenta ahora tiene el rol de <b>${roleList(args.roles)}</b> en el panel
           de XUNTAS+XUNTOS. Entra con la cuenta que ya tienes.
         </p>
         ${button(`${appUrl()}/es/administracion`, 'Ir al panel')}`,
        'Tu cuenta ya tiene acceso al panel.',
      ),
    })
  },
})
```

- [ ] **Step 2: Typecheck and push**

Run: `npm run typecheck && npx convex dev --once`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add convex/emails.ts
git commit -m "feat(roles): invitation and access-granted emails

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `convex/staff.ts` and invite redemption in the webhook

**Files:**
- Create: `convex/staff.ts`
- Modify: `convex/users.ts` (`create`)

**Interfaces:**
- Consumes: Task 1, 2, 5, 6.
- Produces (all in `api.staff` / `internal.staff`):
  - `grantRoles` internal `{ email, roles: string[] }` → `{ userId }`; throws `user_not_found`.
  - `invite` mutation `{ email, roles: string[] }` → `{ kind: 'invited' | 'granted' }`.
  - `resendInvite` mutation `{ inviteId }` → `{ ok: true } | { ok: false; reason: 'wait'; availableAt }`.
  - `revokeInvite` mutation `{ inviteId }` → `{ ok: true }`.
  - `setRoles` mutation `{ userId, roles: string[] }` → `{ ok: true }`.
  - `list` query → `{ staff: StaffRow[]; invites: InviteRow[] }` where
    `StaffRow = { _id, name?, email, roles }`, `InviteRow = { _id, email, roles, status: InviteStatus, expiresAt, lastSentAt, invitedByName }`.
  - `getInvite` query `{ token }` → `{ status: 'invalid' | 'expired' | 'revoked' | 'accepted' } | { status: 'pending'; email; roles; invitedByName }`.

- [ ] **Step 1: Write `convex/staff.ts`**

```ts
import { ConvexError, v } from 'convex/values'
import { internalMutation, mutation, query, type QueryCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import type { AppErrorCode } from './lib/errorCodes'
import { ROLES, type Role } from './lib/permissions'
import {
  INVITE_RESEND_WAIT_MS,
  INVITE_TTL_MS,
  checkRoleChange,
  inviteStatus,
  normalizeStaffRoles,
  validateInvite,
} from './lib/staffRules'
import { newToken } from './lib/tokens'
import { requirePermission } from './users'

/**
 * Errors cross the wire as codes so the browser can say them in the reader's
 * language. A plain `Error` message arrives wrapped in Convex's own framing
 * and is whatever language the server happened to be written in.
 */
function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

const vRoles = v.array(v.string())

async function masterAdminCount(ctx: QueryCtx): Promise<number> {
  const users = await ctx.db.query('users').collect()
  return users.filter((u) => u.roles.includes('master_admin')).length
}

/**
 * Grants without an invitation. Two callers: the CLI bootstrap of the first
 * master_admin, and `invite` when the email already has an account. The
 * athlete role, if present, stays: someone who registered and later joins
 * the staff has not stopped being a registrant.
 */
async function grant(ctx: Parameters<typeof mutation>[0] extends never ? never : any, user: Doc<'users'>, roles: readonly Role[]) {
  const keepAthlete = user.roles.includes('athlete') ? (['athlete'] as const) : []
  const next = [...keepAthlete, ...normalizeStaffRoles(roles)]
  await ctx.db.patch(user._id, { roles: next, updatedAt: Date.now() })
  return next
}

/**
 * Bootstrap. Run by hand, once per deployment:
 *
 *   npx convex run staff:grantRoles '{"email":"…","roles":["master_admin"]}'
 *   npx convex run staff:grantRoles '{"email":"…","roles":["master_admin"]}' --prod
 */
export const grantRoles = internalMutation({
  args: { email: v.string(), roles: vRoles },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email.trim().toLowerCase()))
      .unique()
    if (!user) fail('user_not_found')
    const roles = await grant(ctx, user, normalizeStaffRoles(args.roles))
    console.log(`[staff.grantRoles] ${user.email} → ${roles.join(', ')}`)
    return { userId: user._id }
  },
})

export const invite = mutation({
  args: { email: v.string(), roles: vRoles },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_users')
    const problem = validateInvite(args)
    if (problem) fail(problem)

    const email = args.email.trim().toLowerCase()
    const roles = normalizeStaffRoles(args.roles)
    const now = Date.now()

    // An account already exists: grant directly. An invite link for someone
    // who already signs in is friction that teaches nothing.
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique()
    if (existing) {
      const next = await grant(ctx, existing, [...existing.roles, ...roles])
      await ctx.scheduler.runAfter(0, internal.emails.sendAccessGranted, {
        to: email,
        roles: next.filter((r) => r !== 'athlete'),
      })
      return { kind: 'granted' as const }
    }

    // A pending invite to the same address is replaced, not duplicated: the
    // newest roles win and the old link stops working.
    const pending = (
      await ctx.db
        .query('staffInvites')
        .withIndex('by_email', (q) => q.eq('email', email))
        .collect()
    ).filter((i) => inviteStatus(i, now) === 'pending')
    for (const p of pending) await ctx.db.patch(p._id, { revokedAt: now })

    const token = newToken()
    await ctx.db.insert('staffInvites', {
      email,
      roles,
      token,
      invitedBy: actor._id,
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
      lastSentAt: now,
      timesSent: 1,
    })
    await ctx.scheduler.runAfter(0, internal.emails.sendStaffInvitation, {
      to: email,
      inviterName: actor.name ?? actor.email,
      roles,
      token,
    })
    return { kind: 'invited' as const }
  },
})

export const resendInvite = mutation({
  args: { inviteId: v.id('staffInvites') },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_users')
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) fail('invite_invalid')
    const now = Date.now()
    const status = inviteStatus(invite, now)
    if (status === 'accepted') fail('invite_accepted')
    if (status === 'revoked') fail('invite_revoked')
    if (now - invite.lastSentAt < INVITE_RESEND_WAIT_MS) {
      return { ok: false as const, reason: 'wait' as const, availableAt: invite.lastSentAt + INVITE_RESEND_WAIT_MS }
    }

    // A new token on every resend, and a fresh week: the old link stops working.
    const token = newToken()
    await ctx.db.patch(invite._id, {
      token,
      expiresAt: now + INVITE_TTL_MS,
      lastSentAt: now,
      timesSent: invite.timesSent + 1,
    })
    await ctx.scheduler.runAfter(0, internal.emails.sendStaffInvitation, {
      to: invite.email,
      inviterName: actor.name ?? actor.email,
      roles: invite.roles,
      token,
    })
    return { ok: true as const }
  },
})

export const revokeInvite = mutation({
  args: { inviteId: v.id('staffInvites') },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'manage_users')
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) fail('invite_invalid')
    if (inviteStatus(invite, Date.now()) === 'pending') {
      await ctx.db.patch(invite._id, { revokedAt: Date.now() })
    }
    return { ok: true as const }
  },
})

/**
 * Edits a staff account's roles. Passing no staff roles is the "remove"
 * action: the account stays (with `athlete` if it had it), the person just
 * cannot get in. No email — see docs/DECISIONS.md.
 */
export const setRoles = mutation({
  args: { userId: v.id('users'), roles: vRoles },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_users')
    const target = await ctx.db.get(args.userId)
    if (!target) fail('user_not_found')

    const keepAthlete = target.roles.includes('athlete') ? (['athlete'] as const) : []
    const next: Role[] = [...keepAthlete, ...normalizeStaffRoles(args.roles)]

    const problem = checkRoleChange({
      actorId: actor._id,
      actorRoles: actor.roles,
      targetId: target._id,
      targetRoles: target.roles,
      nextRoles: next,
      masterAdminCount: await masterAdminCount(ctx),
    })
    if (problem) fail(problem)

    await ctx.db.patch(target._id, { roles: next, updatedAt: Date.now() })
    return { ok: true as const }
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, 'view_staff')
    const now = Date.now()

    const users = await ctx.db.query('users').collect()
    const staff = users
      .filter((u) => u.roles.some((r) => r !== 'athlete'))
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        roles: u.roles.filter((r) => r !== 'athlete'),
      }))

    const invites = await ctx.db.query('staffInvites').collect()
    const byId = new Map(users.map((u) => [u._id, u]))
    return {
      staff,
      invites: invites.map((i) => {
        const by = byId.get(i.invitedBy)
        return {
          _id: i._id,
          email: i.email,
          roles: i.roles,
          status: inviteStatus(i, now),
          expiresAt: i.expiresAt,
          lastSentAt: i.lastSentAt,
          invitedByName: by?.name ?? by?.email ?? '',
        }
      }),
    }
  },
})

/**
 * Resolves the link. Public: the invitee has no account yet. It reveals the
 * invited email, which the holder of the link already knows.
 */
export const getInvite = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query('staffInvites')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()
    if (!invite) return { status: 'invalid' as const }
    const status = inviteStatus(invite, Date.now())
    if (status !== 'pending') return { status }
    const by = await ctx.db.get(invite.invitedBy)
    return {
      status,
      email: invite.email,
      roles: invite.roles,
      invitedByName: by?.name ?? by?.email ?? '',
    }
  },
})

// Kept so `ROLES` stays imported once the helper above is typed against it.
export type { Role }
export { ROLES }
```

Replace the untyped `grant` signature with the concrete one — the `any` above is a placeholder the plan forbids. Use:

```ts
import type { MutationCtx } from './_generated/server'

async function grant(ctx: MutationCtx, user: Doc<'users'>, roles: readonly Role[]): Promise<Role[]> {
```

and delete the trailing `export type { Role }` / `export { ROLES }` lines and the `ROLES` import if unused.

- [ ] **Step 2: Redeem the invite in `users.create`**

In `convex/users.ts` `create`, replace `roles: ['athlete'],` in the insert with the result of this lookup placed above the insert:

```ts
    /**
     * A staff invitation is redeemed by the account's primary email, not by
     * a token: a forwarded link is worth nothing to a different address, and
     * a Google sign-up that picks another address simply lands as an athlete
     * (the invite stays pending, and a master_admin can grant directly).
     */
    const invite = (
      await ctx.db
        .query('staffInvites')
        .withIndex('by_email', (q) => q.eq('email', args.email.trim().toLowerCase()))
        .collect()
    ).find((i) => inviteStatus(i, now) === 'pending')

    const roles: Role[] = invite ? [...invite.roles] : ['athlete']
    if (invite) {
      await ctx.db.patch(invite._id, { acceptedAt: now, acceptedBy: args.clerkId })
    }
```

with imports `import { inviteStatus } from './lib/staffRules'` and `import type { Role } from './lib/permissions'`, and `roles,` in the insert. A staff account has no pre-signup and stays without `birthDate`; nothing in the panel asks for it because the panel redirects staff away (Task 8).

- [ ] **Step 3: Typecheck, push, bootstrap**

Run: `npm run check && npx convex dev --once`
Expected: green.

```bash
npx convex run staff:grantRoles '{"email":"gerardogalangarzafox@gmail.com","roles":["master_admin"]}'
```

Expected: `{ userId: "…" }` and the dev dashboard row shows `roles: ["athlete","master_admin"]` (or `["master_admin"]` if the account had no athlete role).

- [ ] **Step 4: Commit**

```bash
git add convex/staff.ts convex/users.ts
git commit -m "feat(roles): staff invitations, role edits, and CLI bootstrap

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `useMe`, the header link, and the athlete-panel redirect

**Files:**
- Create: `src/hooks/useMe.ts`
- Modify: `src/components/AppBar/AccountNav.tsx`
- Modify: `src/components/MyRegistration/RegistrationPanel.tsx`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/components/RegistrationPanel.test.tsx` (extend)

**Interfaces:**
- Produces: `useMe(): { roles: Role[]; permissions: Permission[] } | null | undefined`.

- [ ] **Step 1: Messages**

Add to `es.json`:

```json
  "nav_admin": "Administración",
```

and to `en.json`:

```json
  "nav_admin": "Administration",
```

- [ ] **Step 2: The hook**

```ts
// src/hooks/useMe.ts
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Roles and permissions of the signed-in account. `undefined` while loading,
 * `null` signed out or before the webhook has inserted the row.
 */
export function useMe() {
  return useQuery(api.users.me)
}
```

- [ ] **Step 3: The header link**

In `AccountNav.tsx`, add the import `import { useMe } from '../../hooks/useMe'` and `import { isStaff } from '../../lib/permissions'`, call `const me = useMe()` at the top of the component, and inside `<Show when="signed-in">` before the "Mi registro" link:

```tsx
        {me && isStaff(me.roles) && (
          <Link to="/administracion" className="text-white/72 no-underline hover:text-white">
            {m.nav_admin()}
          </Link>
        )}
```

(`/administracion` does not exist until Task 9; TanStack's route typing will complain until then — do Task 9's route file before running typecheck, or accept the red for one task.)

- [ ] **Step 4: The redirect — failing test first**

Add to `tests/components/RegistrationPanel.test.tsx`, after the existing `vi.mock('convex/react', …)` block's `useQuery` so it can answer per-query: change the mock to

```ts
let queryResult: unknown
let statusResult: unknown

vi.mock('convex/react', () => ({
  useConvexAuth: () => authState,
  useQuery: (fn: unknown) => (fn === 'users:myStatus' ? statusResult : queryResult),
  useMutation: () => vi.fn(),
}))

vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}))
```

and in `beforeEach` add `statusResult = undefined`. Update the three existing tests to set `statusResult` the same as `queryResult`. Then add:

```ts
describe('staff accounts', () => {
  it('sends an account without the athlete role to the admin panel', () => {
    statusResult = {
      account: { roles: ['admin'], emailVerified: true, ageDeclared: false, isMinor: false },
      guardian: { required: false, confirmed: true },
      registration: null,
    }
    queryResult = { registration: null, editable: true, closesAt: 0 }
    render(<RegistrationPanel />)
    expect(screen.getByTestId('navigate')).toHaveTextContent('/administracion')
  })
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run tests/components/RegistrationPanel.test.tsx`
Expected: the new test FAILS (no navigate rendered; the panel asks for a birth date instead).

- [ ] **Step 6: Implement**

In `RegistrationPanel.tsx`, import `Navigate` from `@tanstack/react-router`, and right after the `status === null || mine === null` guard and before the `ageDeclared` guard:

```tsx
  /**
   * Staff have no registration. Clerk's fallback redirect still points at this
   * page (a build arg, not worth a rebuild), so the page itself sends them on.
   * Before the birth-date step, on purpose: a staff account has no date and
   * must never be asked for one.
   */
  if (!status.account.roles.includes('athlete')) {
    return <Navigate to="/administracion" />
  }
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/components/RegistrationPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit** (after Task 9's route exists, so typecheck is green)

```bash
git add src/hooks/useMe.ts src/components/AppBar/AccountNav.tsx src/components/MyRegistration/RegistrationPanel.tsx tests/components/RegistrationPanel.test.tsx messages/es.json messages/en.json
git commit -m "feat(roles): staff see the admin link and skip the athlete panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: `/administracion` layout, index, and the placeholder

**Files:**
- Create: `src/routes/administracion.tsx`, `src/routes/administracion.index.tsx`
- Create: `src/components/Admin/AdminShell.tsx`, `src/components/Admin/NoTools.tsx`
- Modify: `messages/es.json`, `messages/en.json`

**Interfaces:**
- Produces: `AdminShell({ children })` renders the eyebrow/title band and a sub-nav of links filtered by permission; exposes nothing else. Plan 2 adds a cycle selector to this same component.

- [ ] **Step 1: Messages**

`es.json`:

```json
  "admin_eyebrow": "Panel de administración",
  "admin_title": "Administración",
  "admin_nav_registrations": "Registros",
  "admin_nav_staff": "Equipo",
  "admin_nav_cycles": "Convocatorias",
  "admin_signed_out": "Entra con tu cuenta para ver el panel.",
  "admin_no_tools_title": "Tu rol todavía no tiene herramientas aquí",
  "admin_no_tools_text": "Tu cuenta existe y tiene acceso. Las pantallas para tu rol se están construyendo; te avisaremos cuando estén.",
```

`en.json`:

```json
  "admin_eyebrow": "Administration panel",
  "admin_title": "Administration",
  "admin_nav_registrations": "Registrations",
  "admin_nav_staff": "Staff",
  "admin_nav_cycles": "Calls for applications",
  "admin_signed_out": "Sign in to see the panel.",
  "admin_no_tools_title": "Your role has no tools here yet",
  "admin_no_tools_text": "Your account exists and has access. The screens for your role are being built; we'll let you know when they're ready.",
```

- [ ] **Step 2: `NoTools.tsx`**

```tsx
// src/components/Admin/NoTools.tsx
import * as m from '../../paraglide/messages.js'

/**
 * What a coach, finance or health account sees today. They can be invited
 * now — the point of master_admin this cycle is onboarding staff — and this
 * page is what makes that invitation land somewhere honest.
 */
export default function NoTools() {
  return (
    <div className="card mt-8 max-w-[62ch] px-[21px] py-[19px]">
      <b className="mb-1 block font-disp text-[15px]">{m.admin_no_tools_title()}</b>
      <p className="m-0 text-[13px] font-light text-soft">{m.admin_no_tools_text()}</p>
    </div>
  )
}
```

- [ ] **Step 3: `AdminShell.tsx`**

```tsx
// src/components/Admin/AdminShell.tsx
import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import { can, type Permission } from '../../lib/permissions'
import type { Role } from '../../lib/permissions'

type Props = {
  roles: readonly Role[]
  children: React.ReactNode
}

const NAV: ReadonlyArray<{ to: '/administracion/registros' | '/administracion/equipo' | '/administracion/convocatorias'; label: () => string; needs: Permission }> = [
  { to: '/administracion/registros', label: m.admin_nav_registrations, needs: 'review_registrations' },
  { to: '/administracion/equipo', label: m.admin_nav_staff, needs: 'view_staff' },
  { to: '/administracion/convocatorias', label: m.admin_nav_cycles, needs: 'manage_cycles' },
]

/**
 * The frame every admin page sits in: the heading pattern from BRAND.md and
 * a sub-nav that only lists what this account may open. The routes guard
 * themselves too — this is what to draw, not what to allow.
 */
export default function AdminShell({ roles, children }: Props) {
  const links = NAV.filter((n) => can(roles, n.needs))
  return (
    <main className="col pt-[38px] pb-[90px]">
      <p className="eyebrow">{m.admin_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.admin_title()}</h1>
      {links.length > 0 && (
        <nav className="mt-6 flex flex-wrap gap-2 border-b border-line pb-3" aria-label={m.admin_title()}>
          {links.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-ctl border border-transparent px-3 py-1.5 font-mono text-[11.5px] tracking-[.08em] uppercase text-soft no-underline hover:text-ink [&.active]:border-line-2 [&.active]:text-ink"
              activeProps={{ className: 'active' }}
            >
              {n.label()}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </main>
  )
}
```

(`/administracion/registros` and `/administracion/convocatorias` are created in Plans 3 and 2. Until then the `to` union will not typecheck: for this branch, include only `equipo` in `NAV` and leave a comment `// registros and convocatorias join this list with their plans.` Restore the full list in those plans.)

- [ ] **Step 4: The layout route**

```tsx
// src/routes/administracion.tsx
import { Show } from '@clerk/tanstack-react-start'
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import AdminShell from '../components/Admin/AdminShell'
import LoadingFrame from '../components/MyRegistration/LoadingFrame'
import { useMe } from '../hooks/useMe'

export const Route = createFileRoute('/administracion')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.admin_title() }) }] }),
  component: AdminLayout,
})

/**
 * Everything under /administracion. The child routes decide what a given
 * permission may see; this only decides that there is a signed-in account
 * with a Convex row, and draws the frame around whatever the child renders.
 */
function AdminLayout() {
  return (
    <>
      <Show when="signed-out">
        <main className="col col-560 pt-[46px] pb-[90px]">
          <h1 className="h-display text-[clamp(26px,4.6vw,36px)]">{m.nav_sign_in()}</h1>
          <p className="mt-3 font-light text-soft">{m.admin_signed_out()}</p>
          <Link to="/entrar" className="btn mt-6 inline-block no-underline">
            {m.nav_sign_in()}
          </Link>
        </main>
      </Show>
      <Show when="signed-in">
        <SignedIn />
      </Show>
    </>
  )
}

function SignedIn() {
  const me = useMe()
  if (me === undefined) return <LoadingFrame>{m.common_loading()}</LoadingFrame>
  if (me === null) return <LoadingFrame>{m.sync_text()}</LoadingFrame>
  return (
    <AdminShell roles={me.roles}>
      <Outlet />
    </AdminShell>
  )
}
```

- [ ] **Step 5: The index route**

```tsx
// src/routes/administracion.index.tsx
import { Navigate, createFileRoute } from '@tanstack/react-router'
import NoTools from '../components/Admin/NoTools'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'

export const Route = createFileRoute('/administracion/')({
  component: AdminIndex,
})

/**
 * Where /administracion lands: the registrations table for reviewers, the
 * staff page for anyone who may only see that, and the placeholder for a
 * role with no screens yet.
 */
function AdminIndex() {
  const me = useMe()
  if (!me) return null
  if (can(me.roles, 'view_staff')) return <Navigate to="/administracion/equipo" replace />
  return <NoTools />
}
```

(Plan 3 changes the first branch to prefer `/administracion/registros` when `review_registrations` holds.)

- [ ] **Step 6: Generate routes, check, verify in the browser**

Run: `npm run generate-routes && npm run check`
Expected: green; `src/routeTree.gen.ts` lists `/administracion` and `/administracion/`.

Start the dev server (`.claude/launch.json` → `xuntas-registro`), sign in with the bootstrapped account, open `/es/administracion`. Expected: the shell with the "Equipo" tab and a redirect to `/es/administracion/equipo` (404 for now — Task 10 fills it). Sign in with an athlete account: `/es/administracion` shows the placeholder card.

- [ ] **Step 7: Commit (with Task 8's files)**

```bash
git add src/routes/administracion.tsx src/routes/administracion.index.tsx src/components/Admin/AdminShell.tsx src/components/Admin/NoTools.tsx src/routeTree.gen.ts messages/es.json messages/en.json
git commit -m "feat(admin): /administracion layout, index, and no-tools placeholder

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: The staff page

**Files:**
- Create: `src/routes/administracion.equipo.tsx`
- Create: `src/components/Admin/RoleChecks.tsx`, `src/components/Admin/InviteForm.tsx`, `src/components/Admin/StaffTable.tsx`
- Modify: `package.json` (add `@tanstack/react-table`), `messages/es.json`, `messages/en.json`
- Test: `tests/components/StaffTable.test.tsx`

**Interfaces:**
- Consumes: `api.staff.list/invite/resendInvite/revokeInvite/setRoles`; `useMe`.
- Produces:
  - `RoleChecks({ idPrefix, value: Role[], onChange(next: Role[]), disabled? })` — six checkboxes minus `athlete`.
  - `StaffTable({ staff, invites, canManage, meId, onSetRoles, onResend, onRevoke })`.
  - `InviteForm({ onInvite })`.

- [ ] **Step 1: Install the table**

```bash
npm install @tanstack/react-table@^9.2.4
```

- [ ] **Step 2: Messages**

`es.json`:

```json
  "role_admin": "Administración",
  "role_master_admin": "Administración maestra",
  "role_coach": "Coach",
  "role_finance": "Finanzas",
  "role_health": "Salud",
  "staff_invite_title": "Invitar a alguien",
  "staff_invite_email": "Correo",
  "staff_invite_roles": "Roles",
  "staff_invite_send": "Enviar invitación",
  "staff_invited": "Invitación enviada.",
  "staff_granted": "Esa cuenta ya existía: se le dieron los roles.",
  "staff_people_title": "Equipo",
  "staff_invites_title": "Invitaciones",
  "staff_col_name": "Nombre",
  "staff_col_email": "Correo",
  "staff_col_roles": "Roles",
  "staff_col_status": "Estado",
  "staff_col_invited_by": "Invitó",
  "staff_col_expires": "Vence",
  "staff_edit": "Editar roles",
  "staff_save": "Guardar",
  "staff_cancel": "Cancelar",
  "staff_remove": "Quitar acceso",
  "staff_resend": "Reenviar",
  "staff_revoke": "Cancelar invitación",
  "staff_you": "tú",
  "staff_none": "Nadie todavía.",
  "invite_status_pending": "pendiente",
  "invite_status_expired": "vencida",
  "invite_status_accepted": "aceptada",
  "invite_status_revoked": "cancelada",
```

`en.json`:

```json
  "role_admin": "Administration",
  "role_master_admin": "Master administration",
  "role_coach": "Coach",
  "role_finance": "Finance",
  "role_health": "Health",
  "staff_invite_title": "Invite someone",
  "staff_invite_email": "Email",
  "staff_invite_roles": "Roles",
  "staff_invite_send": "Send invitation",
  "staff_invited": "Invitation sent.",
  "staff_granted": "That account already existed: the roles were granted.",
  "staff_people_title": "Staff",
  "staff_invites_title": "Invitations",
  "staff_col_name": "Name",
  "staff_col_email": "Email",
  "staff_col_roles": "Roles",
  "staff_col_status": "Status",
  "staff_col_invited_by": "Invited by",
  "staff_col_expires": "Expires",
  "staff_edit": "Edit roles",
  "staff_save": "Save",
  "staff_cancel": "Cancel",
  "staff_remove": "Remove access",
  "staff_resend": "Resend",
  "staff_revoke": "Cancel invitation",
  "staff_you": "you",
  "staff_none": "Nobody yet.",
  "invite_status_pending": "pending",
  "invite_status_expired": "expired",
  "invite_status_accepted": "accepted",
  "invite_status_revoked": "cancelled",
```

- [ ] **Step 3: `RoleChecks.tsx`**

```tsx
// src/components/Admin/RoleChecks.tsx
import * as m from '../../paraglide/messages.js'
import { ROLES, type Role } from '../../lib/permissions'

export const ROLE_LABEL: Record<Exclude<Role, 'athlete'>, () => string> = {
  admin: m.role_admin,
  master_admin: m.role_master_admin,
  coach: m.role_coach,
  finance: m.role_finance,
  health: m.role_health,
}

export function roleName(role: Role): string {
  return role === 'athlete' ? '' : ROLE_LABEL[role]()
}

type Props = {
  idPrefix: string
  value: readonly Role[]
  onChange: (next: Role[]) => void
  disabled?: boolean
}

/** The staff roles as checkboxes. `athlete` is not offered: it is not a job. */
export default function RoleChecks({ idPrefix, value, onChange, disabled }: Props) {
  const staffRoles = ROLES.filter((r): r is Exclude<Role, 'athlete'> => r !== 'athlete')
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {staffRoles.map((role) => {
        const id = `${idPrefix}-${role}`
        const checked = value.includes(role)
        return (
          <label key={role} htmlFor={id} className="flex items-center gap-2 text-[13px]">
            <input
              id={id}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...value, role] : value.filter((r) => r !== role),
                )
              }
            />
            {ROLE_LABEL[role]()}
          </label>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: `InviteForm.tsx`**

```tsx
// src/components/Admin/InviteForm.tsx
import { useState } from 'react'
import * as m from '../../paraglide/messages.js'
import RoleChecks from './RoleChecks'
import type { Role } from '../../lib/permissions'
import { validateInvite } from '../../../convex/lib/staffRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'

type Props = {
  onInvite: (input: { email: string; roles: Role[] }) => Promise<{ kind: 'invited' | 'granted' }>
}

export default function InviteForm({ onInvite }: Props) {
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setDone(null)
    const problem = validateInvite({ email, roles })
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      const r = await onInvite({ email: email.trim().toLowerCase(), roles })
      setDone(r.kind === 'invited' ? m.staff_invited() : m.staff_granted())
      setEmail('')
      setRoles([])
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card mt-8 max-w-[62ch] px-[21px] py-[19px]">
      <b className="mb-3 block font-disp text-[15px]">{m.staff_invite_title()}</b>
      <label htmlFor="invite-email" className="text-[12.5px] font-medium">
        {m.staff_invite_email()} <span className="text-bad">*</span>
      </label>
      <input
        id="invite-email"
        type="email"
        className="fld-input mt-1.5 mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="off"
      />
      <p className="mb-1.5 text-[12.5px] font-medium">{m.staff_invite_roles()}</p>
      <RoleChecks idPrefix="invite" value={roles} onChange={setRoles} />
      <p className="mt-2 min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? m.common_loading() : m.staff_invite_send()}
        </button>
        {done && <span className="text-[12.5px] text-soft">{done}</span>}
      </div>
    </form>
  )
}
```

- [ ] **Step 5: `StaffTable.tsx` — failing test first**

```tsx
// tests/components/StaffTable.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import StaffTable from '../../src/components/Admin/StaffTable'

const staff = [
  { _id: 'u1', name: 'Gerardo', email: 'g@xuntas.org', roles: ['master_admin'] as const },
  { _id: 'u2', name: 'Ana', email: 'ana@xuntas.org', roles: ['admin'] as const },
]
const invites = [
  {
    _id: 'i1',
    email: 'luis@xuntas.org',
    roles: ['coach'] as const,
    status: 'pending' as const,
    expiresAt: Date.parse('2026-09-10T00:00:00Z'),
    lastSentAt: 0,
    invitedByName: 'Gerardo',
  },
]

function renderTable(canManage: boolean) {
  const onSetRoles = vi.fn(async () => {})
  const onResend = vi.fn(async () => {})
  const onRevoke = vi.fn(async () => {})
  render(
    <StaffTable
      staff={[...staff]}
      invites={[...invites]}
      canManage={canManage}
      meId="u1"
      onSetRoles={onSetRoles}
      onResend={onResend}
      onRevoke={onRevoke}
    />,
  )
  return { onSetRoles, onResend, onRevoke }
}

describe('StaffTable', () => {
  it('lists people with their role names and marks the reader', () => {
    renderTable(false)
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText(m.role_admin())).toBeInTheDocument()
    expect(screen.getByText(new RegExp(m.staff_you()))).toBeInTheDocument()
  })

  it('offers no edit controls without manage_users', () => {
    renderTable(false)
    expect(screen.queryByRole('button', { name: m.staff_edit() })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.staff_resend() })).not.toBeInTheDocument()
  })

  it('saves an edited set of roles', () => {
    const { onSetRoles } = renderTable(true)
    fireEvent.click(screen.getAllByRole('button', { name: m.staff_edit() })[1])
    fireEvent.click(screen.getByLabelText(m.role_coach()))
    fireEvent.click(screen.getByRole('button', { name: m.staff_save() }))
    expect(onSetRoles).toHaveBeenCalledWith('u2', ['admin', 'coach'])
  })

  it('lists invitations with their status and lets a manager resend or revoke', () => {
    const { onResend, onRevoke } = renderTable(true)
    expect(screen.getByText('luis@xuntas.org')).toBeInTheDocument()
    expect(screen.getByText(m.invite_status_pending())).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.staff_resend() }))
    expect(onResend).toHaveBeenCalledWith('i1')
    fireEvent.click(screen.getByRole('button', { name: m.staff_revoke() }))
    expect(onRevoke).toHaveBeenCalledWith('i1')
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run tests/components/StaffTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Write `StaffTable.tsx`**

```tsx
// src/components/Admin/StaffTable.tsx
import { useMemo, useState } from 'react'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import * as m from '../../paraglide/messages.js'
import RoleChecks, { roleName } from './RoleChecks'
import type { Role } from '../../lib/permissions'
import { useDateFormats } from '../DateField/format'

export type StaffRow = { _id: string; name?: string; email: string; roles: readonly Role[] }
export type InviteRow = {
  _id: string
  email: string
  roles: readonly Role[]
  status: 'pending' | 'expired' | 'accepted' | 'revoked'
  expiresAt: number
  lastSentAt: number
  invitedByName: string
}

type Props = {
  staff: StaffRow[]
  invites: InviteRow[]
  canManage: boolean
  meId: string
  onSetRoles: (userId: string, roles: Role[]) => Promise<void>
  onResend: (inviteId: string) => Promise<void>
  onRevoke: (inviteId: string) => Promise<void>
}

/**
 * v9 asks for the features up front so the bundle only carries what the
 * table uses: sorting here, nothing else. Filtering happens on the data
 * before it reaches the table — a few dozen rows do not need an engine.
 */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})

const staffHelper = createColumnHelper<typeof features, StaffRow>()
const inviteHelper = createColumnHelper<typeof features, InviteRow>()

const INVITE_STATUS: Record<InviteRow['status'], () => string> = {
  pending: m.invite_status_pending,
  expired: m.invite_status_expired,
  accepted: m.invite_status_accepted,
  revoked: m.invite_status_revoked,
}

const CHIP: Record<InviteRow['status'], string> = {
  pending: 'chip chip-warn',
  expired: 'chip',
  accepted: 'chip chip-ok',
  revoked: 'chip chip-bad',
}

export default function StaffTable({
  staff,
  invites,
  canManage,
  meId,
  onSetRoles,
  onResend,
  onRevoke,
}: Props) {
  const fmt = useDateFormats()
  /** Which row is being edited, and the roles typed so far. */
  const [editing, setEditing] = useState<{ id: string; roles: Role[] } | null>(null)

  const staffColumns = useMemo(
    () =>
      staffHelper.columns([
        staffHelper.accessor((r) => r.name ?? '', {
          id: 'name',
          header: m.staff_col_name,
          sortFn: 'text',
          cell: (c) => (
            <>
              {c.getValue()}
              {c.row.original._id === meId && (
                <span className="ml-2 font-mono text-[10px] text-soft">({m.staff_you()})</span>
              )}
            </>
          ),
        }),
        staffHelper.accessor('email', { header: m.staff_col_email, sortFn: 'text' }),
        staffHelper.display({
          id: 'roles',
          header: m.staff_col_roles,
          cell: (c) => {
            const row = c.row.original
            if (editing?.id === row._id) {
              return (
                <RoleChecks
                  idPrefix={`edit-${row._id}`}
                  value={editing.roles}
                  onChange={(roles) => setEditing({ id: row._id, roles })}
                />
              )
            }
            return (
              <span className="flex flex-wrap gap-1">
                {row.roles.map((r) => (
                  <span key={r} className="chip">
                    {roleName(r)}
                  </span>
                ))}
              </span>
            )
          },
        }),
        staffHelper.display({
          id: 'actions',
          header: '',
          cell: (c) => {
            if (!canManage) return null
            const row = c.row.original
            if (editing?.id === row._id) {
              return (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      void onSetRoles(row._id, editing.roles)
                      setEditing(null)
                    }}
                  >
                    {m.staff_save()}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                    {m.staff_cancel()}
                  </button>
                </span>
              )
            }
            return (
              <span className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing({ id: row._id, roles: [...row.roles] })}
                >
                  {m.staff_edit()}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm hover:border-bad hover:text-bad"
                  onClick={() => void onSetRoles(row._id, [])}
                >
                  {m.staff_remove()}
                </button>
              </span>
            )
          },
        }),
      ]),
    [canManage, editing, meId, onSetRoles],
  )

  const inviteColumns = useMemo(
    () =>
      inviteHelper.columns([
        inviteHelper.accessor('email', { header: m.staff_col_email, sortFn: 'text' }),
        inviteHelper.display({
          id: 'roles',
          header: m.staff_col_roles,
          cell: (c) => c.row.original.roles.map(roleName).join(', '),
        }),
        inviteHelper.accessor('status', {
          header: m.staff_col_status,
          cell: (c) => <span className={CHIP[c.getValue()]}>{INVITE_STATUS[c.getValue()]()}</span>,
        }),
        inviteHelper.accessor('invitedByName', { header: m.staff_col_invited_by }),
        inviteHelper.accessor('expiresAt', {
          header: m.staff_col_expires,
          cell: (c) => fmt.full.format(new Date(c.getValue())),
        }),
        inviteHelper.display({
          id: 'actions',
          header: '',
          cell: (c) => {
            const row = c.row.original
            if (!canManage || row.status !== 'pending') return null
            return (
              <span className="flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onResend(row._id)}>
                  {m.staff_resend()}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm hover:border-bad hover:text-bad"
                  onClick={() => void onRevoke(row._id)}
                >
                  {m.staff_revoke()}
                </button>
              </span>
            )
          },
        }),
      ]),
    [canManage, fmt.full, onResend, onRevoke],
  )

  const staffTable = useTable({ features, columns: staffColumns, data: staff }, (s) => s)
  const inviteTable = useTable({ features, columns: inviteColumns, data: invites }, (s) => s)

  return (
    <>
      <h2 className="h-display mt-9 text-[18px]">{m.staff_people_title()}</h2>
      <Table table={staffTable} empty={m.staff_none()} />
      <h2 className="h-display mt-9 text-[18px]">{m.staff_invites_title()}</h2>
      <Table table={inviteTable} empty={m.staff_none()} />
    </>
  )
}

/**
 * One rendering for both tables. `table.FlexRender` is v9's replacement for
 * the `flexRender` function; header cells toggle sorting when they can.
 */
function Table<T extends ReturnType<typeof useTable<typeof features, any>>>({
  table,
  empty,
}: {
  table: T
  empty: string
}) {
  const rows = table.getRowModel().rows
  return (
    <div className="card mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-line">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-3 py-2 text-left font-mono text-[10.5px] font-medium tracking-[.12em] uppercase text-soft"
                  aria-sort={h.column.getIsSorted() === 'asc' ? 'ascending' : h.column.getIsSorted() === 'desc' ? 'descending' : undefined}
                >
                  {h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <button type="button" className="font-inherit" onClick={h.column.getToggleSortingHandler()}>
                      <table.FlexRender header={h} />
                    </button>
                  ) : (
                    <table.FlexRender header={h} />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-3 font-light text-soft" colSpan={99}>
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-top">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

Replace the `any` in `Table`'s generic with the concrete types: `import type { Table as TanTable } from '@tanstack/react-table'` and type the prop as `table: TanTable<typeof features, StaffRow> | TanTable<typeof features, InviteRow>`. If the union does not typecheck against `FlexRender`, split into two thin wrappers `StaffRows` and `InviteRows` that each call the shared markup with their own concrete type. Confirm the exact export names (`useTable`, `tableFeatures`, `rowSortingFeature`, `createSortedRowModel`, `sortFn_text`, `createColumnHelper`, `FlexRender` on the table instance) against `node_modules/@tanstack/react-table/dist/esm/index.d.ts` before writing — the migration guide is the source, and the names above come from it.

- [ ] **Step 8: Run the test**

Run: `npx vitest run tests/components/StaffTable.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: The route**

```tsx
// src/routes/administracion.equipo.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import InviteForm from '../components/Admin/InviteForm'
import NoTools from '../components/Admin/NoTools'
import StaffTable from '../components/Admin/StaffTable'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'
import { describeConvexError } from '../lib/registrationErrors'
import { useState } from 'react'

export const Route = createFileRoute('/administracion/equipo')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.admin_nav_staff() }) }] }),
  component: StaffPage,
})

function StaffPage() {
  const me = useMe()
  const list = useQuery(api.staff.list, me && can(me.roles, 'view_staff') ? {} : 'skip')
  const invite = useMutation(api.staff.invite)
  const setRoles = useMutation(api.staff.setRoles)
  const resend = useMutation(api.staff.resendInvite)
  const revoke = useMutation(api.staff.revokeInvite)
  const [error, setError] = useState<string | null>(null)

  if (!me) return null
  if (!can(me.roles, 'view_staff')) return <NoTools />
  if (list === undefined) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  const canManage = can(me.roles, 'manage_users')

  /** Every mutation surfaces its code here; the table itself stays dumb. */
  async function guard(run: () => Promise<unknown>) {
    setError(null)
    try {
      await run()
    } catch (err) {
      setError(describeConvexError(err))
    }
  }

  return (
    <>
      {canManage && <InviteForm onInvite={(input) => invite(input)} />}
      {error && <p className="mt-4 text-[12.5px] text-bad">{error}</p>}
      <StaffTable
        staff={list.staff}
        invites={list.invites}
        canManage={canManage}
        meId={list.staff.find((s) => s.email === me.email)?._id ?? ''}
        onSetRoles={(userId, roles) => guard(() => setRoles({ userId: userId as never, roles }))}
        onResend={(inviteId) => guard(() => resend({ inviteId: inviteId as never }))}
        onRevoke={(inviteId) => guard(() => revoke({ inviteId: inviteId as never }))}
      />
    </>
  )
}
```

`me.email` does not exist on `users.me` — add `email: user.email` to the `me` query's return in `convex/users.ts` (Task 5) and to `useMe`'s type. Replace the `as never` casts with the generated id types: `import type { Id } from '../../convex/_generated/dataModel'` and type `StaffRow._id` as `Id<'users'>`, `InviteRow._id` as `Id<'staffInvites'>` in `StaffTable.tsx`; the test then builds its fixtures with `'u1' as Id<'users'>`.

- [ ] **Step 10: Generate routes, check, verify in the browser**

Run: `npm run generate-routes && npm run check`
Expected: green.

In the browser as master_admin: `/es/administracion/equipo` shows the invite form, your own row marked "(tú)", and empty invitations. Invite a `@resend.dev` address as `coach` → row appears as "pendiente"; the dev Convex logs show the email queued. Click "Editar roles" on your row, untick `master_admin`, "Guardar" → error text "No puedes quitarte a ti mismo…". Sign in as an `admin` account → the form is absent and there are no buttons.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/routes/administracion.equipo.tsx src/components/Admin src/routeTree.gen.ts tests/components/StaffTable.test.tsx messages/es.json messages/en.json convex/users.ts src/hooks/useMe.ts
git commit -m "feat(admin): staff page with invitations and role editing

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: The invitation landing page

**Files:**
- Create: `src/routes/invitacion.$token.tsx`, `src/routes/invitacion.$token.$.tsx`
- Create: `src/components/InviteScreen.tsx`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/components/InviteScreen.test.tsx`

**Interfaces:**
- Consumes: `api.staff.getInvite`, Clerk `<SignUp>`.
- Produces: `InviteScreen()` reads `token` from the route params.

- [ ] **Step 1: Messages**

`es.json`:

```json
  "invite_eyebrow": "Invitación al panel",
  "invite_title": "Te invitaron al panel",
  "invite_lede": "{name} te invitó como {roles}. Crea tu cuenta con el correo {email}: la invitación está ligada a ese correo.",
  "invite_invalid_title": "Esta invitación no existe",
  "invite_expired_title": "Esta invitación venció",
  "invite_revoked_title": "Esta invitación fue cancelada",
  "invite_accepted_title": "Esta invitación ya fue usada",
  "invite_closed_text": "Pide a quien te invitó que te envíe otra.",
```

`en.json`:

```json
  "invite_eyebrow": "Panel invitation",
  "invite_title": "You've been invited to the panel",
  "invite_lede": "{name} invited you as {roles}. Create your account with the email {email}: the invitation is bound to that address.",
  "invite_invalid_title": "This invitation doesn't exist",
  "invite_expired_title": "This invitation expired",
  "invite_revoked_title": "This invitation was cancelled",
  "invite_accepted_title": "This invitation was already used",
  "invite_closed_text": "Ask whoever invited you to send another one.",
```

- [ ] **Step 2: Failing test**

```tsx
// tests/components/InviteScreen.test.tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

let inviteResult: unknown

vi.mock('convex/react', () => ({ useQuery: () => inviteResult }))
vi.mock('@clerk/tanstack-react-start', () => ({
  SignUp: (props: { initialValues?: { emailAddress?: string } }) => (
    <div data-testid="signup">{props.initialValues?.emailAddress}</div>
  ),
}))
vi.mock('@tanstack/react-router', () => ({ useParams: () => ({ token: 't1' }) }))
vi.mock('../../convex/_generated/api', () => ({ api: { staff: { getInvite: 'staff:getInvite' } } }))
vi.mock('../../src/components/ThemeProvider', () => ({ useThemeContext: () => ({ resolved: 'light' }) }))

const { default: InviteScreen } = await import('../../src/components/InviteScreen')

beforeEach(() => {
  inviteResult = undefined
})

describe('InviteScreen', () => {
  it('shows who invited and mounts the sign-up with the email prefilled', () => {
    inviteResult = { status: 'pending', email: 'luis@xuntas.org', roles: ['coach'], invitedByName: 'Gerardo' }
    render(<InviteScreen />)
    expect(screen.getByText(m.invite_title())).toBeInTheDocument()
    expect(screen.getByTestId('signup')).toHaveTextContent('luis@xuntas.org')
  })

  it('says why a dead link is dead, without a sign-up', () => {
    inviteResult = { status: 'expired' }
    render(<InviteScreen />)
    expect(screen.getByText(m.invite_expired_title())).toBeInTheDocument()
    expect(screen.queryByTestId('signup')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/components/InviteScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: `InviteScreen.tsx`**

```tsx
// src/components/InviteScreen.tsx
import { SignUp } from '@clerk/tanstack-react-start'
import { useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import { localizeHref } from '../paraglide/runtime.js'
import { clerkAppearance } from '../lib/clerkAppearance'
import { roleName } from './Admin/RoleChecks'
import { useThemeContext } from './ThemeProvider'

const CLOSED_TITLE = {
  invalid: m.invite_invalid_title,
  expired: m.invite_expired_title,
  revoked: m.invite_revoked_title,
  accepted: m.invite_accepted_title,
} as const

/**
 * Where an invitation lands. No age gate and no pre-signup: staff are not
 * registrants. The email is prefilled and the webhook redeems the invite by
 * matching it, so a different address signs up as a plain athlete.
 */
export default function InviteScreen() {
  const { token } = useParams({ strict: false }) as { token: string }
  const invite = useQuery(api.staff.getInvite, { token })
  const { resolved } = useThemeContext()

  if (invite === undefined) {
    return <main className="col col-560 py-16 text-soft">{m.common_loading()}</main>
  }

  if (invite.status !== 'pending') {
    return (
      <main className="col col-560 pt-[46px] pb-[90px]">
        <p className="eyebrow">{m.invite_eyebrow()}</p>
        <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,36px)]">{CLOSED_TITLE[invite.status]()}</h1>
        <p className="mt-3 font-light text-soft">{m.invite_closed_text()}</p>
      </main>
    )
  }

  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.invite_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.invite_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">
        {m.invite_lede({
          name: invite.invitedByName,
          roles: invite.roles.map(roleName).join(', '),
          email: invite.email,
        })}
      </p>
      <p className="mt-2 max-w-[52ch] text-[13px] font-light text-soft">{m.account_no_password()}</p>
      <div className="mt-8">
        <SignUp
          appearance={clerkAppearance(resolved)}
          initialValues={{ emailAddress: invite.email }}
          routing="path"
          path={localizeHref(`/invitacion/${token}`)}
          signInUrl={localizeHref('/entrar')}
          forceRedirectUrl={localizeHref('/administracion')}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Routes**

```tsx
// src/routes/invitacion.$token.tsx
import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import InviteScreen from '../components/InviteScreen'

export const Route = createFileRoute('/invitacion/$token')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.invite_title() }) }] }),
  component: InviteScreen,
})
```

```tsx
// src/routes/invitacion.$token.$.tsx
import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import InviteScreen from '../components/InviteScreen'

/** Clerk's internal steps (code, SSO callback) route under the invite path. */
export const Route = createFileRoute('/invitacion/$token/$')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.invite_title() }) }] }),
  component: InviteScreen,
})
```

- [ ] **Step 6: Run tests, routes, check, and the real flow**

Run: `npx vitest run tests/components/InviteScreen.test.tsx && npm run generate-routes && npm run check`
Expected: green.

End to end in dev: with `RESEND_TEST_MODE` unset, invite `delivered@resend.dev` as `admin`; copy the token from the `staffInvites` row in the dashboard; open `/es/invitacion/<token>` in a private window → the screen names you and the role and shows Clerk's sign-up with the email filled. (Completing the sign-up needs a real inbox: use your own second address with `RESEND_TEST_MODE=false` in dev only if you have one, otherwise verify the webhook path by inserting a `staffInvites` row for an address you control and signing up with it.) After sign-up, the `users` row must carry the invited roles and the invite `acceptedAt`.

- [ ] **Step 7: Commit**

```bash
git add src/routes/invitacion.\$token.tsx 'src/routes/invitacion.$token.$.tsx' src/components/InviteScreen.tsx src/routeTree.gen.ts tests/components/InviteScreen.test.tsx messages/es.json messages/en.json
git commit -m "feat(roles): invitation landing page with Clerk sign-up

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Docs, prod bootstrap, PR

**Files:**
- Modify: `docs/DECISIONS.md`, `README.md`, `docs/DEPLOYMENT.md`

- [ ] **Step 1: `docs/DECISIONS.md`**

Under "## Product", replace the "six-role portal" paragraph with:

```markdown
**Roles are a Convex-owned array, behind a permission table.** `users.roles`
holds `athlete | admin | master_admin | coach | finance | health`;
`convex/lib/permissions.ts` maps roles to permissions and every guard reads a
permission. Clerk's `publicMetadata.role` is no longer read. `master_admin` is
a superset. `coach`, `finance` and `health` exist so they can be invited now;
their screens come later. Design: `docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md`.

**Staff are invited by the app, not from Clerk.** `staffInvites` binds an
invitation to an email; the `user.created` webhook redeems it by matching the
account's primary address. Removal revokes roles and never deletes the
account: `validatedBy` must keep pointing at a person, and deletion is the
person's own LFPDPPP right. Nobody can remove their own `master_admin`, and
the last one cannot be removed by anyone.
```

Under "## Open items", delete item 3 ("Emails that get an admin invitation") and renumber.

Update "Last reviewed" to `September 3, 2026`.

- [ ] **Step 2: `README.md`**

Replace the "## Administrators" section with:

```markdown
## Administrators

Roles live in Convex (`users.roles`), not in Clerk. The first `master_admin`
is granted from the CLI, once per deployment:

```bash
npx convex run staff:grantRoles '{"email":"you@xuntas.org","roles":["master_admin"]}'
npx convex run staff:grantRoles '{"email":"you@xuntas.org","roles":["master_admin"]}' --prod
```

The account must already exist (sign up first). From then on, staff are
invited from `/administracion/equipo`. See `convex/lib/permissions.ts` for
what each role may do.
```

- [ ] **Step 3: `docs/DEPLOYMENT.md`**

In §4, replace the last paragraph ("Both require the account to have `role: "admin"`…") with:

```markdown
Both require an account whose `users.roles` grants `review_registrations`
(`admin` or `master_admin`). Roles are granted from the CLI
(`staff:grantRoles`, see the README) or from `/administracion/equipo`.
```

Add to the §5 checklist under **Convex**:

```markdown
- [ ] `staff:grantRoles … --prod` run for the master_admin account
```

- [ ] **Step 4: Bootstrap prod**

```bash
npx convex deploy
npx convex run staff:grantRoles '{"email":"gerardogalangarzafox@gmail.com","roles":["master_admin"]}' --prod
```

Expected: `{ userId: "…" }`. (The account must exist in prod first — sign up there if it does not.)

- [ ] **Step 5: Final check and PR**

Run: `npm run check`
Expected: green.

```bash
git add docs/DECISIONS.md README.md docs/DEPLOYMENT.md
git commit -m "docs: Convex owns roles; invitations move out of Clerk

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin feat/roles-and-invitations
gh pr create --title "feat: roles, permissions and staff invitations" --body "$(cat <<'EOF'
## Summary
- `users.roles` (Convex-owned, six roles) replaces the Clerk-mirrored `role`; guards read permissions from `convex/lib/permissions.ts`
- staff invitations (`staffInvites`), invitation + access emails, `/invitacion/$token` landing with Clerk sign-up
- `/administracion` layout, staff page with invite / edit / revoke, placeholder for roles without screens
- schema transition in two deploys with `users:backfillRoles` between them; prod backfilled and master_admin bootstrapped

Spec: docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md

## Test plan
- [ ] `npm run check`
- [ ] invite a new address → lands on `/invitacion/<token>`, signs up, gets the roles
- [ ] invite an existing athlete → roles granted, access email sent
- [ ] removing own master_admin refused; removing the last one refused
- [ ] admin account sees the staff page read-only; athlete account sees the placeholder

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage.** §1 roles (T1, T3–T5), superset (T1), Convex-owned + three write paths (T5, T7), permission table (T1), migration + bootstrap (T3–T5, T7, T12). §2 table (T3), flow 1–4 (T7, T11), removal + guards (T2, T7), emails (T6). §4 routes `/administracion`, index, `equipo`, `/invitacion` (T9–T11), landing redirect (T8), header link (T8), bilingual (every task's messages). Docs amendments (T12).

**Placeholders.** The `any` in T7's first `grant` signature and T10's `Table` generic are each followed by the concrete replacement in the same step; executors must apply the replacement, not the draft. No other TBDs.

**Type consistency.** `requirePermission(ctx, permission)` (T5) is used by T7 and Plan 3. `users.me` returns `{ roles, permissions, email }` — `email` is added in T10 step 9's note; apply it in T5 when implementing so `useMe` is right from the start. `StaffRow._id: Id<'users'>`, `InviteRow._id: Id<'staffInvites'>` per T10 step 9. `inviteStatus(invite, now)` argument order is `(invite, now)` everywhere.
