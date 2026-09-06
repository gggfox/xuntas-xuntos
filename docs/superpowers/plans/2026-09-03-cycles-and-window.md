# Cycles and Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the call-for-applications window from constants to a `cycles` table that a `master_admin` edits from `/administracion/convocatorias`, with every date-bearing string interpolated from it, an audit trail of changes, and the development hatch deleted.

**Architecture:** One `cycles` row per call, exactly one `isActive`. `convex/lib/cycleRules.ts` is the pure module (window arithmetic in the fixed UTC-6, validation, formatting); `convex/cycles.ts` exposes `activeCycle(ctx)` / `requireWindowOpen(ctx)` to the other Convex modules and `cycles.active` to the client, which reads it through one hook. `Calendar`/`DayGrid` learn a range so a `RangeField` can pick opens/closes on a single grid. Every copy string that spelled out a date takes it as a parameter.

**Tech Stack:** Convex 1.45, TanStack Start/Router 1.x, React 19, Paraglide 2.24, Vitest 3.2.

**Spec:** [`docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md`](../specs/2026-09-03-admin-roles-cycles-review-design.md) §3, §4. Read it first. Requires Plan 1 (`feat/roles-and-invitations`) merged: `requirePermission`, `AdminShell`, `useMe`.

## Global Constraints

- **Branch:** `feat/cycles-and-window`, cut from `main` after Plan 1 merges. One PR. `npm run check` green before every commit.
- **Rules modules import nothing** from `convex/_generated`, `convex/values`, or Paraglide.
- **Convex thrown errors** are `ConvexError({ code })`; every new code gets `es` + `en` messages and a `MESSAGES` entry in `src/lib/registrationErrors.ts`.
- **Mexico City is UTC-6 all year** (no DST since 2022). Day boundaries: opens `00:00:00.000`, closes `23:59:59.999`, both local. Store days as `yyyy-mm-dd` strings; never a `Date` in local time (see `src/components/DateField/date.ts` header).
- **Seed before the code that reads it deploys.** Task 2's `cycles:seed` runs in dev and `--prod` before Task 3 ships; without a row `activeCycle` throws `no_active_cycle` on every request.
- **Deleting the hatch is part of the definition of done.** `WINDOW_ALWAYS_OPEN` and `VITE_WINDOW_ALWAYS_OPEN` must not survive in code, config, env files, or docs.
- **Design rules** (`docs/BRAND.md`); the range tint uses `--color-wash` — no new colours.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

---

## File structure

| File | Responsibility |
|---|---|
| `convex/lib/cycleRules.ts` | Window arithmetic, validation, title and date formatting. Pure. |
| `convex/lib/cycle.ts` | Keeps only `ageAt`, `isUnderage`, `isValidBirthDate`. Constants and `isWindowOpen` leave. |
| `convex/schema.ts` | `cycles`, `cycleChanges`; `CURRENT_CYCLE` export removed. |
| `convex/cycles.ts` | `activeCycle`, `requireWindowOpen`, `seed`, `active`, `list`, `create`, `update`, `setActive`. |
| `convex/registrations.ts`, `convex/guardian.ts`, `convex/users.ts`, `convex/emails.ts` | Read the active cycle instead of constants. |
| `src/lib/cycle.ts` | Re-exports the pure rules for the client. |
| `src/hooks/useActiveCycle.ts` | `useQuery(api.cycles.active)`. |
| `src/hooks/useAdminCycle.ts` | The cycle the admin pages look at (`?ciclo=`), defaulting to the active one. |
| `src/components/DateField/Calendar.tsx`, `DayGrid.tsx`, `calendar.css` | Optional range tint. |
| `src/components/DateField/RangeField.tsx` | Opens/closes on one grid, two typed boxes. |
| `src/components/Admin/CycleForm.tsx`, `CyclesPanel.tsx`, `CycleSelect.tsx` | The cycles screen and the selector in the shell. |
| `src/routes/administracion.convocatorias.tsx` | Route. |
| Copy consumers (`__root.tsx`, `index.tsx`, `LoadingFrame.tsx`, `RegistrationForm/index.tsx`, `RegistrationClosedNotice.tsx`, `SignUpScreen.tsx`, `RegistrationPanel.tsx`, `bases.tsx`, …) | Take the date from the hook. |
| `messages/es.json`, `messages/en.json` | Parameterised strings. |
| `vitest.config.ts`, `.env.example`, `.env.local`, `README.md`, `docs/DEPLOYMENT.md`, `docs/DECISIONS.md` | Hatch removed; docs amended. |
| `tests/cycleRules.test.ts`, `tests/cycle.test.ts`, `tests/components/RangeField.test.tsx` | Tests. |

---

### Task 1: Cycle rules module

**Files:**
- Create: `convex/lib/cycleRules.ts`
- Modify: `convex/lib/errorCodes.ts`, `messages/es.json`, `messages/en.json`, `src/lib/registrationErrors.ts`
- Test: `tests/cycleRules.test.ts`

**Interfaces:**
- Produces:
  - `const MX_OFFSET_MS = 6 * 60 * 60 * 1000`
  - `type CycleFields = { opensOn: string; closesOn: string; reviewOn: string; isActive: boolean }`
  - `type CycleInput = { cycle: string; opensOn: string; closesOn: string; reviewOn: string }`
  - `function dayStartMs(iso: string): number | null` — 00:00 Mexico City of that day.
  - `function dayEndMs(iso: string): number | null` — 23:59:59.999.
  - `function windowOf(c: { opensOn: string; closesOn: string }): { opensAtMs: number; closesAtMs: number }` — throws on an unreadable day (rows are validated on write).
  - `function isWindowOpenFor(c: { opensOn: string; closesOn: string }, now?: number): boolean`
  - `function validateCycle(input: CycleInput): AppErrorCode | null`
  - `function titleOf(cycle: string, locale: 'es' | 'en'): string`
  - `function formatDay(iso: string, locale: 'es' | 'en'): string`
- New codes: `cycle_name_invalid`, `cycle_dates_invalid`, `cycle_review_before_close`, `cycle_exists`, `cycle_not_found`, `no_active_cycle`, `window_open`.

- [ ] **Step 1: Error codes and messages**

Add to `ActionErrorCode` in `convex/lib/errorCodes.ts`, before `'generic'`:

```ts
  // Cycles.
  | 'cycle_name_invalid'
  | 'cycle_dates_invalid'
  | 'cycle_review_before_close'
  | 'cycle_exists'
  | 'cycle_not_found'
  | 'no_active_cycle'
  | 'window_open'
```

`es.json`:

```json
  "err_cycle_name_invalid": "El nombre debe ser dos años seguidos, como 2027-2028.",
  "err_cycle_dates_invalid": "La fecha de cierre tiene que ser igual o posterior a la de apertura.",
  "err_cycle_review_before_close": "La fecha de revisión tiene que ser posterior al cierre.",
  "err_cycle_exists": "Ya existe una convocatoria con ese nombre.",
  "err_cycle_not_found": "No encontramos esa convocatoria.",
  "err_no_active_cycle": "No hay ninguna convocatoria activa.",
  "err_window_open": "El periodo de registro sigue abierto.",
  "err_window_closed": "El periodo de registro está cerrado.",
```

`en.json`:

```json
  "err_cycle_name_invalid": "The name must be two consecutive years, like 2027-2028.",
  "err_cycle_dates_invalid": "The closing date must be on or after the opening date.",
  "err_cycle_review_before_close": "The review date must be after the closing date.",
  "err_cycle_exists": "A call with that name already exists.",
  "err_cycle_not_found": "We couldn't find that call.",
  "err_no_active_cycle": "There is no active call for applications.",
  "err_window_open": "The registration period is still open.",
  "err_window_closed": "The registration period is closed.",
```

`src/lib/registrationErrors.ts` — change `window_closed: m.reg_closed,` to `window_closed: m.err_window_closed,` (Task 4 gives `reg_closed` a date parameter, and an error has none to give) and add:

```ts
  cycle_name_invalid: m.err_cycle_name_invalid,
  cycle_dates_invalid: m.err_cycle_dates_invalid,
  cycle_review_before_close: m.err_cycle_review_before_close,
  cycle_exists: m.err_cycle_exists,
  cycle_not_found: m.err_cycle_not_found,
  no_active_cycle: m.err_no_active_cycle,
  window_open: m.err_window_open,
```

- [ ] **Step 2: Failing tests**

```ts
// tests/cycleRules.test.ts
import { describe, expect, it } from 'vitest'
import {
  dayEndMs,
  dayStartMs,
  formatDay,
  isWindowOpenFor,
  titleOf,
  validateCycle,
  windowOf,
} from '../convex/lib/cycleRules'

const C2026 = { cycle: '2026-2027', opensOn: '2026-09-04', closesOn: '2026-09-18', reviewOn: '2026-09-23' }

describe('day boundaries in Mexico City', () => {
  /** The values the constants used to hold, so nothing moves when the row replaces them. */
  it('reproduces the 2026 constants', () => {
    expect(dayStartMs('2026-09-04')).toBe(Date.parse('2026-09-04T06:00:00.000Z'))
    expect(dayEndMs('2026-09-18')).toBe(Date.parse('2026-09-19T05:59:59.999Z'))
  })

  it('refuses a day that is not one', () => {
    expect(dayStartMs('2026-02-30')).toBeNull()
    expect(dayEndMs('18/09/2026')).toBeNull()
  })
})

describe('isWindowOpenFor', () => {
  const { opensAtMs, closesAtMs } = windowOf(C2026)

  it('is closed before opening and open right at opening time', () => {
    expect(isWindowOpenFor(C2026, opensAtMs - 1)).toBe(false)
    expect(isWindowOpenFor(C2026, opensAtMs)).toBe(true)
  })

  it('is still open at the last millisecond and closes afterwards', () => {
    expect(isWindowOpenFor(C2026, closesAtMs)).toBe(true)
    expect(isWindowOpenFor(C2026, closesAtMs + 1)).toBe(false)
  })
})

describe('validateCycle', () => {
  it('accepts the 2026 row', () => {
    expect(validateCycle(C2026)).toBeNull()
  })

  it('wants two consecutive years as the name', () => {
    expect(validateCycle({ ...C2026, cycle: '2026' })).toBe('cycle_name_invalid')
    expect(validateCycle({ ...C2026, cycle: '2026-2028' })).toBe('cycle_name_invalid')
  })

  it('refuses a close before the open, and unreadable days', () => {
    expect(validateCycle({ ...C2026, closesOn: '2026-09-03' })).toBe('cycle_dates_invalid')
    expect(validateCycle({ ...C2026, opensOn: 'soon' })).toBe('cycle_dates_invalid')
  })

  it('allows a one-day window', () => {
    expect(validateCycle({ ...C2026, closesOn: '2026-09-04' })).toBeNull()
  })

  it('wants the review after the close', () => {
    expect(validateCycle({ ...C2026, reviewOn: '2026-09-18' })).toBe('cycle_review_before_close')
  })
})

describe('copy helpers', () => {
  it('derives the title from the name', () => {
    expect(titleOf('2026-2027', 'es')).toBe('Convocatoria General 2026–2027')
    expect(titleOf('2026-2027', 'en')).toBe('2026–2027 General Call for Applications')
  })

  it('spells a day out the way the copy already did', () => {
    expect(formatDay('2026-09-18', 'es')).toBe('18 de septiembre de 2026')
    expect(formatDay('2026-09-18', 'en')).toBe('September 18, 2026')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/cycleRules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the module**

```ts
// convex/lib/cycleRules.ts
import type { AppErrorCode } from './errorCodes'

/**
 * The call-for-applications window, as arithmetic over a `cycles` row.
 *
 * Mexico no longer observes daylight saving time (since 2022), so
 * America/Mexico_City is UTC-6 all year round. Days are stored as
 * `yyyy-mm-dd` and turned into instants here and nowhere else, so the client
 * and the server cannot disagree about when September 18 ends.
 */

export const MX_OFFSET_MS = 6 * 60 * 60 * 1000

export type CycleFields = {
  opensOn: string
  closesOn: string
  reviewOn: string
  isActive: boolean
}

export type CycleInput = {
  cycle: string
  opensOn: string
  closesOn: string
  reviewOn: string
}

/** A `yyyy-mm-dd` to its three numbers, or null if it is not a real day. */
function parts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const probe = new Date(Date.UTC(y, mo - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null
  }
  return { y, m: mo, d }
}

/** 00:00:00.000 of that day, Mexico City. */
export function dayStartMs(iso: string): number | null {
  const p = parts(iso)
  if (!p) return null
  return Date.UTC(p.y, p.m - 1, p.d) + MX_OFFSET_MS
}

/** 23:59:59.999 of that day, Mexico City. */
export function dayEndMs(iso: string): number | null {
  const start = dayStartMs(iso)
  return start === null ? null : start + 24 * 60 * 60 * 1000 - 1
}

/** Rows are validated on write, so an unreadable day here is a bug, not input. */
export function windowOf(c: { opensOn: string; closesOn: string }): {
  opensAtMs: number
  closesAtMs: number
} {
  const opensAtMs = dayStartMs(c.opensOn)
  const closesAtMs = dayEndMs(c.closesOn)
  if (opensAtMs === null || closesAtMs === null) {
    throw new Error(`[cycleRules] unreadable window ${c.opensOn}..${c.closesOn}`)
  }
  return { opensAtMs, closesAtMs }
}

export function isWindowOpenFor(
  c: { opensOn: string; closesOn: string },
  now: number = Date.now(),
): boolean {
  const { opensAtMs, closesAtMs } = windowOf(c)
  return now >= opensAtMs && now <= closesAtMs
}

const NAME_RE = /^(\d{4})-(\d{4})$/

export function validateCycle(input: CycleInput): AppErrorCode | null {
  const name = NAME_RE.exec(input.cycle.trim())
  if (!name || Number(name[2]) !== Number(name[1]) + 1) return 'cycle_name_invalid'

  const opens = dayStartMs(input.opensOn)
  const closes = dayEndMs(input.closesOn)
  if (opens === null || closes === null || closes < opens) return 'cycle_dates_invalid'

  const review = dayStartMs(input.reviewOn)
  if (review === null || review <= closes) return 'cycle_review_before_close'

  return null
}

/** Derived, never typed: fewer free-text fields means fewer ways for two pages to disagree. */
export function titleOf(cycle: string, locale: 'es' | 'en'): string {
  const pretty = cycle.replace('-', '–')
  return locale === 'es'
    ? `Convocatoria General ${pretty}`
    : `${pretty} General Call for Applications`
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The shape the copy already used: "18 de septiembre de 2026" / "September 18, 2026". */
export function formatDay(iso: string, locale: 'es' | 'en'): string {
  const p = parts(iso)
  if (!p) return iso
  return locale === 'es'
    ? `${p.d} de ${MONTHS_ES[p.m - 1]} de ${p.y}`
    : `${MONTHS_EN[p.m - 1]} ${p.d}, ${p.y}`
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/cycleRules.test.ts && npm run typecheck`
Expected: PASS (11 tests); typecheck green.

- [ ] **Step 6: Commit**

```bash
git add convex/lib/cycleRules.ts convex/lib/errorCodes.ts messages/es.json messages/en.json src/lib/registrationErrors.ts tests/cycleRules.test.ts
git commit -m "feat(cycles): window rules over a cycle row, in Mexico City time

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `cycles` tables and `convex/cycles.ts`; seed dev and prod

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/cycles.ts`

**Interfaces:**
- Produces:
  - `cycles`, `cycleChanges` tables as in spec §3.
  - `async function activeCycle(ctx: QueryCtx): Promise<Doc<'cycles'>>` — throws `no_active_cycle`.
  - `async function requireWindowOpen(ctx: QueryCtx): Promise<Doc<'cycles'>>` — throws `window_closed`.
  - `cycles.seed` internal `{}` → `{ inserted: boolean }`.
  - `cycles.active` query → `{ cycle, opensOn, closesOn, reviewOn, opensAtMs, closesAtMs, isOpen, beforeOpening } | null`.
  - `cycles.list` query (`manage_cycles` or `review_registrations`) → `Array<{ _id, cycle, opensOn, closesOn, reviewOn, isActive, updatedAt }>`.
  - `cycles.changes` query `{ cycle }` (`manage_cycles`) → `Array<{ changedAt, changedByName, before, after }>`.
  - `cycles.create` mutation `CycleInput` → `{ ok: true }`.
  - `cycles.update` mutation `{ cycle, opensOn, closesOn, reviewOn }` → `{ ok: true }`.
  - `cycles.setActive` mutation `{ cycle }` → `{ ok: true }`.

- [ ] **Step 1: Schema**

Remove `export const CURRENT_CYCLE = '2026-2027'` and its comment from `convex/schema.ts` (Task 3 fixes the importers). Add after `staffInvites`:

```ts
  /**
   * One row per call for applications; exactly one is active. Registrations
   * and guardian authorizations already carry `cycle`, so this is the table
   * that string was always pointing at. Dates are Mexico City days — see
   * convex/lib/cycleRules.ts for how they become instants.
   */
  cycles: defineTable({
    cycle: v.string(),
    opensOn: v.string(),
    closesOn: v.string(),
    reviewOn: v.string(),
    isActive: v.boolean(),
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_cycle', ['cycle'])
    .index('by_active', ['isActive']),

  /**
   * Who moved the window, when, from what to what. The dates decide whether
   * a family's registration gets in; changing them leaves a trail.
   */
  cycleChanges: defineTable({
    cycle: v.string(),
    changedBy: v.id('users'),
    changedAt: v.number(),
    before: v.union(v.null(), vCycleFields),
    after: vCycleFields,
  }).index('by_cycle', ['cycle']),
```

with, above `export default defineSchema`:

```ts
const vCycleFields = v.object({
  opensOn: v.string(),
  closesOn: v.string(),
  reviewOn: v.string(),
  isActive: v.boolean(),
})
```

(`createdBy` is optional only so the seed can run before any staff row exists.)

- [ ] **Step 2: `convex/cycles.ts`**

```ts
import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import type { Doc } from './_generated/dataModel'
import type { AppErrorCode } from './lib/errorCodes'
import {
  isWindowOpenFor,
  validateCycle,
  windowOf,
  type CycleFields,
} from './lib/cycleRules'
import { currentUser, requirePermission } from './users'
import { can } from './lib/permissions'

function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

/** The one call athletes register into. Every other module reads it through here. */
export async function activeCycle(ctx: QueryCtx): Promise<Doc<'cycles'>> {
  const row = await ctx.db
    .query('cycles')
    .withIndex('by_active', (q) => q.eq('isActive', true))
    .unique()
  if (!row) fail('no_active_cycle')
  return row
}

/** Frozen outside the window. Applies to draft and to submitted alike. */
export async function requireWindowOpen(ctx: QueryCtx): Promise<Doc<'cycles'>> {
  const row = await activeCycle(ctx)
  if (!isWindowOpenFor(row)) fail('window_closed')
  return row
}

const fieldsOf = (c: Doc<'cycles'>): CycleFields => ({
  opensOn: c.opensOn,
  closesOn: c.closesOn,
  reviewOn: c.reviewOn,
  isActive: c.isActive,
})

async function record(
  ctx: MutationCtx,
  by: Doc<'users'>,
  cycle: string,
  before: CycleFields | null,
  after: CycleFields,
) {
  await ctx.db.insert('cycleChanges', { cycle, changedBy: by._id, changedAt: Date.now(), before, after })
}

/**
 * The 2026–2027 row, from the values the constants used to hold. Idempotent.
 * Run once per deployment BEFORE the code that reads it deploys:
 *
 *   npx convex run cycles:seed
 *   npx convex run cycles:seed --prod
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', '2026-2027'))
      .unique()
    if (existing) return { inserted: false }
    const now = Date.now()
    await ctx.db.insert('cycles', {
      cycle: '2026-2027',
      opensOn: '2026-09-04',
      closesOn: '2026-09-18',
      reviewOn: '2026-09-23',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    return { inserted: true }
  },
})

/** Public: the landing page reads it signed out. */
export const active = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query('cycles')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .unique()
    if (!row) return null
    const { opensAtMs, closesAtMs } = windowOf(row)
    const now = Date.now()
    return {
      cycle: row.cycle,
      opensOn: row.opensOn,
      closesOn: row.closesOn,
      reviewOn: row.reviewOn,
      opensAtMs,
      closesAtMs,
      isOpen: now >= opensAtMs && now <= closesAtMs,
      beforeOpening: now < opensAtMs,
    }
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user || !(can(user.roles, 'manage_cycles') || can(user.roles, 'review_registrations'))) {
      fail('permission_required')
    }
    const rows = await ctx.db.query('cycles').collect()
    return rows
      .sort((a, b) => b.cycle.localeCompare(a.cycle))
      .map((c) => ({
        _id: c._id,
        cycle: c.cycle,
        opensOn: c.opensOn,
        closesOn: c.closesOn,
        reviewOn: c.reviewOn,
        isActive: c.isActive,
        updatedAt: c.updatedAt,
      }))
  },
})

export const changes = query({
  args: { cycle: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'manage_cycles')
    const rows = await ctx.db
      .query('cycleChanges')
      .withIndex('by_cycle', (q) => q.eq('cycle', args.cycle))
      .collect()
    const out = []
    for (const r of rows.sort((a, b) => b.changedAt - a.changedAt)) {
      const by = await ctx.db.get(r.changedBy)
      out.push({
        changedAt: r.changedAt,
        changedByName: by?.name ?? by?.email ?? '',
        before: r.before,
        after: r.after,
      })
    }
    return out
  },
})

const vInput = {
  cycle: v.string(),
  opensOn: v.string(),
  closesOn: v.string(),
  reviewOn: v.string(),
}

export const create = mutation({
  args: vInput,
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_cycles')
    const problem = validateCycle(args)
    if (problem) fail(problem)
    const cycle = args.cycle.trim()
    const dup = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', cycle))
      .unique()
    if (dup) fail('cycle_exists')

    const now = Date.now()
    const fields: CycleFields = {
      opensOn: args.opensOn,
      closesOn: args.closesOn,
      reviewOn: args.reviewOn,
      // Never active on creation: activating is its own, deliberate action.
      isActive: false,
    }
    await ctx.db.insert('cycles', { cycle, ...fields, createdBy: actor._id, createdAt: now, updatedAt: now })
    await record(ctx, actor, cycle, null, fields)
    return { ok: true as const }
  },
})

export const update = mutation({
  args: vInput,
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_cycles')
    const problem = validateCycle(args)
    if (problem) fail(problem)
    const row = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', args.cycle.trim()))
      .unique()
    if (!row) fail('cycle_not_found')

    const after: CycleFields = { ...fieldsOf(row), opensOn: args.opensOn, closesOn: args.closesOn, reviewOn: args.reviewOn }
    await ctx.db.patch(row._id, { ...after, updatedAt: Date.now() })
    await record(ctx, actor, row.cycle, fieldsOf(row), after)
    return { ok: true as const }
  },
})

/** One transaction: the previous active goes off, the target goes on, one trail row each. */
export const setActive = mutation({
  args: { cycle: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'manage_cycles')
    const target = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', args.cycle.trim()))
      .unique()
    if (!target) fail('cycle_not_found')
    if (target.isActive) return { ok: true as const }

    const now = Date.now()
    const current = await ctx.db
      .query('cycles')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .unique()
    if (current) {
      const after = { ...fieldsOf(current), isActive: false }
      await ctx.db.patch(current._id, { isActive: false, updatedAt: now })
      await record(ctx, actor, current.cycle, fieldsOf(current), after)
    }
    const after = { ...fieldsOf(target), isActive: true }
    await ctx.db.patch(target._id, { isActive: true, updatedAt: now })
    await record(ctx, actor, target.cycle, fieldsOf(target), after)
    return { ok: true as const }
  },
})
```

- [ ] **Step 3: Push and seed**

```bash
npx convex dev --once
npx convex run cycles:seed
npx convex deploy
npx convex run cycles:seed --prod
```

Expected: `{ inserted: true }` in both; a second run returns `{ inserted: false }`.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/cycles.ts
git commit -m "feat(cycles): cycles table, audit trail, and the 2026-2027 seed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Typecheck is red until Task 3: `CURRENT_CYCLE` importers.)

---

### Task 3: Convex reads the row; constants and the hatch leave

**Files:**
- Modify: `convex/lib/cycle.ts`, `convex/registrations.ts`, `convex/guardian.ts`, `convex/users.ts`, `convex/emails.ts`
- Modify: `tests/cycle.test.ts`, `vitest.config.ts`, `.env.example`, `.env.local`

**Interfaces:**
- `convex/lib/cycle.ts` exports only `ageAt`, `isUnderage`, `isValidBirthDate`.
- `emails.sendAthleteConfirmation` args gain `closesOnText: string`, `reviewOnText: string`; `emails.sendGuardianAuthorization` args gain `closesOnText: string`.
- `registrations.mine` returns `{ registration, editable, closesAt, cycle }`.

- [ ] **Step 1: `convex/lib/cycle.ts`**

Delete `CURRENT_CYCLE`, `OPENS_AT_MS`, `CLOSES_AT_MS`, `REVIEW_DATE`, `isWindowForced`, `isWindowOpen` and their comments. Replace the file header with:

```ts
/**
 * Age arithmetic for the age gate. The window itself lives in the `cycles`
 * table now — see `convex/lib/cycleRules.ts` and `convex/cycles.ts`.
 */
```

Keep `OFFSET_MX_MS` (rename to import `MX_OFFSET_MS` from `./cycleRules` to have one definition), `isoParts`, `isValidBirthDate`, `ageAt`, `isUnderage`.

- [ ] **Step 2: `tests/cycle.test.ts`**

Delete the `isWindowOpen` describe block and the `CLOSES_AT_MS`, `OPENS_AT_MS`, `isWindowOpen` imports. The rest stays.

- [ ] **Step 3: `vitest.config.ts`**

Remove the three `env: { WINDOW_ALWAYS_OPEN: '' }` lines and the comment block about the hatch above `projects`.

- [ ] **Step 4: `.env.example` and `.env.local`**

Delete the "Development only: opens the registration window…" block (both `VITE_WINDOW_ALWAYS_OPEN` lines and the comment) from `.env.example`. Delete `VITE_VENTANA_SIEMPRE_ABIERTA=true` and its comment from `.env.local`.

- [ ] **Step 5: `convex/registrations.ts`**

- Replace `import { CURRENT_CYCLE, CLOSES_AT_MS, isWindowOpen } from './lib/cycle'` with `import { activeCycle, requireWindowOpen } from './cycles'` and `import { formatDay, windowOf } from './lib/cycleRules'`.
- Delete the local `requireWindowOpen()` function.
- `mine`: 

```ts
    const cycle = await activeCycle(ctx)
    const registration = await ctx.db
      .query('registrations')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', cycle.cycle))
      .unique()
    const { closesAtMs } = windowOf(cycle)
    return {
      registration,
      editable: isWindowOpenFor(cycle),
      closesAt: closesAtMs,
      cycle: cycle.cycle,
    }
```

  (import `isWindowOpenFor` too.)
- `saveDraft` and `submit`: replace `requireWindowOpen()` with `const cycle = await requireWindowOpen(ctx)` and every `CURRENT_CYCLE` with `cycle.cycle`. In `submit`'s email call add:

```ts
        closesOnText: formatDay(cycle.closesOn, 'es'),
        reviewOnText: formatDay(cycle.reviewOn, 'es'),
```

- `listForAdmin`: replace `CURRENT_CYCLE` with the active cycle's name for now (`const cycle = await activeCycle(ctx)` → `cycle.cycle`). Plan 3 gives it a `cycle` argument.

- [ ] **Step 6: `convex/guardian.ts`**

Replace the `CURRENT_CYCLE, CLOSES_AT_MS` import with `import { activeCycle } from './cycles'` and `import { formatDay, windowOf } from './lib/cycleRules'`. In `resend` and `correctEmail`: `const cycle = await activeCycle(ctx)`, use `cycle.cycle` in the index lookup, `expiresAt: windowOf(cycle).closesAtMs`, and add `closesOnText: formatDay(cycle.closesOn, 'es')` to both `sendGuardianAuthorization` calls.

- [ ] **Step 7: `convex/users.ts`**

Replace the `CURRENT_CYCLE, CLOSES_AT_MS` import likewise. `myStatus`: `const cycle = await activeCycle(ctx)` and `cycle.cycle` in both lookups. `openGuardianAuthorization`: take `cycle: Doc<'cycles'>` as a fourth parameter; use `cycle.cycle`, `windowOf(cycle).closesAtMs`, and pass `closesOnText`. Its two callers (`create`, `declareBirthDate`) fetch `await activeCycle(ctx)` first. `activeCycle` is in `cycles.ts` which imports `users.ts` — that is a module cycle; to break it, move `currentUser`, `requireUser`, `requirePermission` and `fail` into a new `convex/lib/auth.ts`? No: they need `QueryCtx`, which is generated and fine to import from `_generated/server`. Do it: create `convex/auth.ts` holding `fail`, `currentUser`, `requireUser`, `requirePermission`; `users.ts`, `cycles.ts`, `staff.ts`, `registrations.ts`, `guardian.ts` import from `./auth`. `users.ts` keeps re-exporting them so Plan 1's imports still resolve:

```ts
export { currentUser, requireUser, requirePermission } from './auth'
```

- [ ] **Step 8: `convex/emails.ts`**

Remove the `REVIEW_DATE` import. `sendAthleteConfirmation` args add `closesOnText: v.string(), reviewOnText: v.string()`; replace `${REVIEW_DATE}` with `${textForEmail(args.reviewOnText)}` and `hasta el 18 de septiembre a las 23:59` with `hasta el ${textForEmail(args.closesOnText)} a las 23:59`. `sendGuardianAuthorization` args add `closesOnText: v.string()`; replace `El enlace vence el 18 de septiembre de 2026.` with `El enlace vence el ${textForEmail(args.closesOnText)}.`.

- [ ] **Step 9: Check and push**

Run: `npm run check && npx convex dev --once`
Expected: green (the client still imports `OPENS_AT_MS` etc. from `src/lib/cycle.ts` — Task 4 fixes that; if typecheck flags it now, do Task 4 step 1 first).

- [ ] **Step 10: Commit**

```bash
git add convex tests/cycle.test.ts vitest.config.ts .env.example
git commit -m "feat(cycles): Convex reads the active cycle; constants and the dev hatch removed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(`.env.local` is gitignored; edit it locally anyway.)

---

### Task 4: The client reads the row; every date string is a parameter

**Files:**
- Modify: `src/lib/cycle.ts`, `src/lib/preSignup.ts` (unchanged imports still resolve — check)
- Create: `src/hooks/useActiveCycle.ts`
- Modify: `messages/es.json`, `messages/en.json`
- Modify: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/bases.tsx`, `src/components/MyRegistration/LoadingFrame.tsx`, `src/components/RegistrationForm/index.tsx`, `src/components/Home/RegistrationClosedNotice.tsx`, `src/components/SignUpScreen.tsx`, `src/components/MyRegistration/RegistrationPanel.tsx`, and any other `m.brand_cycle()` / `m.reg_eyebrow()` / `m.done_*()` caller
- Modify: `tests/components/RegistrationForm.test.tsx`, `tests/components/RegistrationWizard.test.tsx` (new prop)

**Interfaces:**
- `useActiveCycle()` → `FunctionReturnType<typeof api.cycles.active> | undefined`.
- `src/lib/cycle.ts` re-exports `formatDay`, `titleOf`, `isWindowOpenFor`, `windowOf` from `cycleRules` plus `ageAt`, `isUnderage` from `cycle`.
- `RegistrationForm` gains a required prop `closesOnText: string`.
- `LoadingFrame` gains an optional prop `reviewOnText?: string`.

- [ ] **Step 1: `src/lib/cycle.ts` and the hook**

```ts
// src/lib/cycle.ts
/**
 * Re-exports the cycle rules from the backend. The dates themselves live in
 * the `cycles` table and reach the client through `useActiveCycle`; what is
 * shared here is the arithmetic, so the two sides cannot disagree about when
 * a day ends.
 */
export { ageAt, isUnderage } from '../../convex/lib/cycle'
export { formatDay, isWindowOpenFor, titleOf, windowOf } from '../../convex/lib/cycleRules'
```

```ts
// src/hooks/useActiveCycle.ts
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getLocale } from '../paraglide/runtime.js'
import { formatDay, titleOf } from '../lib/cycle'

/**
 * The active call, with its dates already spelled out in the page's locale.
 * `undefined` while loading, `null` if no cycle is active (a configuration
 * fault, not a state the UI designs for).
 */
export function useActiveCycle() {
  const c = useQuery(api.cycles.active)
  if (!c) return c
  const locale = getLocale() as 'es' | 'en'
  return {
    ...c,
    title: titleOf(c.cycle, locale),
    opensOnText: formatDay(c.opensOn, locale),
    closesOnText: formatDay(c.closesOn, locale),
    reviewOnText: formatDay(c.reviewOn, locale),
  }
}
```

- [ ] **Step 2: Messages**

Change these keys in `es.json` (values with parameters):

```json
  "brand_cycle": "Convocatoria {cycle}",
  "meta_title": "Registro · XUNTAS+XUNTOS",
  "meta_description": "Registro al Programa de Desarrollo de XUNTAS+XUNTOS.",
  "account_lede": "Con tu cuenta puedes guardar el registro a medias y volver después. Editas cuando quieras hasta el {date}.",
  "reg_eyebrow": "{title}",
  "reg_closing": "El periodo de registro cierra el {date}.",
  "reg_closed": "El periodo de registro está cerrado. Cerró el {date}.",
  "done_review": "Revisamos tu registro antes del {date}.",
  "done_editable": "Puedes editar tus datos hasta el {date} a las 23:59, hora del centro de México.",
  "account_closed_text": "La {title} abre el {date}.",
  "rules_dates": "El registro abre el {opens} y cierra el {closes} a las 23:59, hora del centro de México. Las solicitudes se revisan antes del {review}.",
```

and in `en.json`:

```json
  "brand_cycle": "{cycle} Call for Applications",
  "meta_title": "Registration · XUNTAS+XUNTOS",
  "meta_description": "Registration for the XUNTAS+XUNTOS Development Program.",
  "account_lede": "With your account you can save a half-finished registration and come back later. You can edit whenever you want until {date}.",
  "reg_eyebrow": "{title}",
  "reg_closing": "The registration period closes on {date}.",
  "reg_closed": "The registration period is closed. It closed on {date}.",
  "done_review": "We will review your registration before {date}.",
  "done_editable": "You can edit your details until {date} at 11:59 PM, Central Mexico time.",
  "account_closed_text": "The {title} opens on {date}.",
  "rules_dates": "Registration opens on {opens} and closes on {closes} at 11:59 PM, Central Mexico time. Applications are reviewed before {review}.",
```

Run `npm run paraglide` so the message functions gain their parameters; typecheck then lists every caller.

- [ ] **Step 3: Callers**

Run `grep -rn "brand_cycle()\|reg_eyebrow()\|reg_closing()\|reg_closed()\|done_review()\|done_editable()\|account_lede()\|account_closed_text()\|REVIEW_DATE\|OPENS_AT_MS\|CLOSES_AT_MS\|isWindowOpen(" src` and fix each:

- `src/routes/__root.tsx` footer: extract a `Footer` component that calls `useActiveCycle()` and renders `{c ? \`${m.brand_cycle({ cycle: c.cycle })} · ${m.reg_closing({ date: c.closesOnText })}\` : null}`. (It must sit inside `ThemedProviders` to have the Convex client — it already does.)
- `src/routes/index.tsx`: `const c = useActiveCycle()`; while `c === undefined` render the lede and brief with nothing where the actions go; then `c?.isOpen ? <RegistrationActions /> : <RegistrationClosedNotice beforeOpening={c?.beforeOpening ?? false} title={c?.title ?? ''} opensOnText={c?.opensOnText ?? ''} closesOnText={c?.closesOnText ?? ''} />` and the closing eyebrow with `c.closesOnText`.
- `RegistrationClosedNotice`: props `beforeOpening, title, opensOnText, closesOnText`; `m.account_closed_text({ title, date: opensOnText })` and `m.reg_closed({ date: closesOnText })`.
- `LoadingFrame`: prop `reviewOnText?: string`; render `m.done_review({ date: reviewOnText })` only when given, else nothing on that line. Its callers in `RegistrationPanel` pass `reviewOnText={cycle?.reviewOnText}` from `useActiveCycle()`; `administracion.tsx` passes nothing.
- `RegistrationForm/index.tsx`: prop `closesOnText: string`; footer `editable ? m.reg_closing({ date: closesOnText }) : m.reg_closed({ date: closesOnText })`. Both test files that render `RegistrationForm` add `closesOnText="18 de septiembre de 2026"`.
- `RegistrationPanel`: `const cycle = useActiveCycle()`; `m.reg_eyebrow({ title: cycle?.title ?? '' })`; pass `closesOnText={cycle?.closesOnText ?? ''}` to the form.
- `SignUpScreen`: `m.account_lede({ date: cycle?.closesOnText ?? '' })`.
- `bases.tsx`: replace the "Fechas" paragraph body with `{c ? m.rules_dates({ opens: c.opensOnText, closes: c.closesOnText, review: c.reviewOnText }) : m.common_loading()}`; eyebrow `m.brand_cycle({ cycle: c?.cycle ?? '' })`.
- `SessionFrame`, `ErrorScreen`, `autorizar.$token.tsx`, `aviso-de-privacidad.tsx`, any other `brand_cycle()` caller: `useActiveCycle()` and `m.brand_cycle({ cycle: c?.cycle ?? '' })`. Where the component cannot host a hook conveniently, pass the string down.
- `done_editable`: grep shows its callers; thread `closesOnText` the same way.
- `src/lib/preSignup.ts`: still exports `ageAt, isUnderage, isValidBirthDate` from `convex/lib/cycle` — unchanged.

- [ ] **Step 4: Check and verify in the browser**

Run: `npm run check`
Expected: green.

In the browser: the landing page reads "cierra el 18 de septiembre de 2026" and the closed notice "La Convocatoria General 2026–2027 abre el 4 de septiembre de 2026"; `/en/` shows the English forms. Change `closesOn` on the dev row in the Convex dashboard to `2026-10-01` → the page updates without a deploy. Change it back.

- [ ] **Step 5: Commit**

```bash
git add src messages tests
git commit -m "feat(cycles): client reads the active cycle; every date in copy is a parameter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Range tint in the calendar and the `RangeField`

**Files:**
- Modify: `src/components/DateField/Calendar.tsx`, `DayGrid.tsx`, `calendar.css`
- Create: `src/components/DateField/RangeField.tsx`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/components/RangeField.test.tsx`

**Interfaces:**
- `Calendar` and `DayGrid` gain `rangeEnd?: Ymd | null`. With both `selected` and `rangeEnd`, days get `data-range="start" | "mid" | "end"`.
- `RangeField({ id, label, start, end, onChange({ start, end }), min?, max?, error? })` — `start`/`end` are ISO or `''`.

- [ ] **Step 1: Messages**

`es.json`: `"range_start": "Apertura"`, `"range_end": "Cierre"`, `"range_hint": "Elige el día de apertura y luego el de cierre."`
`en.json`: `"range_start": "Opens"`, `"range_end": "Closes"`, `"range_hint": "Pick the opening day, then the closing day."`

- [ ] **Step 2: Failing test**

```tsx
// tests/components/RangeField.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RangeField from '../../src/components/DateField/RangeField'

function renderField(start = '', end = '') {
  const onChange = vi.fn<(v: { start: string; end: string }) => void>()
  render(
    <RangeField id="win" label="Ventana" start={start} end={end} onChange={onChange} min="2026-09-01" max="2026-09-30" />,
  )
  return { onChange }
}

describe('RangeField', () => {
  it('takes the first click as the start and the second as the end', () => {
    const { onChange } = renderField()
    fireEvent.click(screen.getByRole('button', { name: /4 de septiembre|September 4/ }))
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-04', end: '' })
  })

  it('completes the range on the second click and starts over on the third', () => {
    const { onChange } = renderField('2026-09-04', '')
    fireEvent.click(screen.getByRole('button', { name: /18 de septiembre|September 18/ }))
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-04', end: '2026-09-18' })
  })

  it('swaps a second click that lands before the first', () => {
    const { onChange } = renderField('2026-09-18', '')
    fireEvent.click(screen.getByRole('button', { name: /4 de septiembre|September 4/ }))
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-04', end: '2026-09-18' })
  })

  it('tints the days between start and end', () => {
    renderField('2026-09-04', '2026-09-06')
    expect(screen.getByRole('button', { name: /5 de septiembre|September 5/ })).toHaveAttribute('data-range', 'mid')
    expect(screen.getByRole('button', { name: /4 de septiembre|September 4/ })).toHaveAttribute('data-range', 'start')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/components/RangeField.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: `DayGrid` and `Calendar`**

`DayGrid.tsx`: add `rangeEnd?: Ymd | null` to `Props`; inside the map, before `return`:

```ts
          const range =
            selected && rangeEnd
              ? isSame(day, selected)
                ? 'start'
                : isSame(day, rangeEnd)
                  ? 'end'
                  : compare(day, selected) > 0 && compare(day, rangeEnd) < 0
                    ? 'mid'
                    : undefined
              : undefined
```

and on the `<button>`: `data-range={range}`. The end day also reads as pressed: `aria-pressed={isSame(day, selected) || isSame(day, rangeEnd)}`.

`Calendar.tsx`: add `rangeEnd?: Ymd | null` to `Props`, destructure it, pass `rangeEnd={rangeEnd ?? null}` to `<DayGrid>`.

`calendar.css`, inside `@layer components` after the `.cal-day[aria-pressed="true"]` rules:

```css
  /* The days between the two ends of a range: a wash, so the two ink cells
     that bound it stay the only things that read as chosen. */
  .cal-day[data-range="mid"] {
    background: var(--color-wash);
    border-radius: 0;
  }
  .cal-day[data-range="start"] {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  .cal-day[data-range="end"] {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
```

- [ ] **Step 5: `RangeField.tsx`**

```tsx
// src/components/DateField/RangeField.tsx
import { useMemo } from 'react'
import * as m from '../../paraglide/messages.js'
import { compare, parseISO, todayMX, toISO, type Ymd } from './date'
import { useDateFormats } from './format'
import Calendar from './Calendar'

type Props = {
  id: string
  label: string
  /** ISO days or empty. */
  start: string
  end: string
  onChange: (next: { start: string; end: string }) => void
  /** ISO bounds. Defaults: today to five years ahead. */
  min?: string
  max?: string
  error?: string
}

/**
 * Two days on one grid. First click is the start, second the end, third
 * starts over; a second click before the first swaps them, so "closes before
 * opens" cannot be entered rather than merely being invalid. The typed boxes
 * beside it are for the person who already knows the dates.
 */
export default function RangeField({ id, label, start, end, onChange, min, max, error }: Props) {
  const fmt = useDateFormats()
  const today = useMemo(() => todayMX(), [])
  const lo = useMemo(() => parseISO(min ?? '') ?? today, [min, today])
  const hi = useMemo(() => parseISO(max ?? '') ?? { ...today, y: today.y + 5 }, [max, today])
  const startDay = useMemo(() => parseISO(start), [start])
  const endDay = useMemo(() => parseISO(end), [end])

  function pick(day: Ymd) {
    if (!startDay || endDay) {
      onChange({ start: toISO(day), end: '' })
      return
    }
    if (compare(day, startDay) < 0) {
      onChange({ start: toISO(day), end: toISO(startDay) })
      return
    }
    onChange({ start: toISO(startDay), end: toISO(day) })
  }

  const errorId = `${id}-err`

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12.5px] font-medium">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12.5px]">
          <span className="eyebrow block">{m.range_start()}</span>
          <input
            id={`${id}-start`}
            className="fld-input mt-1 font-mono tracking-[0.04em] tabular-nums"
            value={start}
            placeholder="aaaa-mm-dd"
            onChange={(e) => onChange({ start: e.target.value, end })}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        <label className="text-[12.5px]">
          <span className="eyebrow block">{m.range_end()}</span>
          <input
            id={`${id}-end`}
            className="fld-input mt-1 font-mono tracking-[0.04em] tabular-nums"
            value={end}
            placeholder="aaaa-mm-dd"
            onChange={(e) => onChange({ start, end: e.target.value })}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
      </div>
      <Calendar
        id={`${id}-cal`}
        label={label}
        selected={startDay}
        rangeEnd={endDay}
        today={today}
        min={lo}
        max={hi}
        openAt={startDay ?? today}
        fmt={fmt}
        onPick={pick}
      />
      <p id={errorId} className={`min-h-[1.45em] text-[11.5px] leading-[1.45] ${error ? 'text-bad' : 'text-soft'}`}>
        {error ?? m.range_hint()}
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/components/RangeField.test.tsx tests/components/MonthField.test.tsx`
Expected: PASS; the month field's tests still pass (its grid never mounts days).

- [ ] **Step 7: Commit**

```bash
git add src/components/DateField tests/components/RangeField.test.tsx messages/es.json messages/en.json
git commit -m "feat(cycles): range picker on the existing calendar grid

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The cycles screen and the selector in the shell

**Files:**
- Create: `src/routes/administracion.convocatorias.tsx`
- Create: `src/components/Admin/CycleForm.tsx`, `src/components/Admin/CyclesPanel.tsx`, `src/components/Admin/CycleSelect.tsx`
- Create: `src/hooks/useAdminCycle.ts`
- Modify: `src/routes/administracion.tsx` (search param), `src/components/Admin/AdminShell.tsx`
- Modify: `messages/es.json`, `messages/en.json`

**Interfaces:**
- `/administracion` layout route gains `validateSearch` → `{ ciclo?: string }`.
- `useAdminCycle()` → `{ cycle: string | undefined; setCycle(c: string): void; cycles: CycleRow[] | undefined }` — `cycle` defaults to the active one once `cycles.list` loads.
- `CycleForm({ initial?: CycleInput, onSubmit(input): Promise<void>, submitLabel })`.
- `AdminShell` renders `<CycleSelect />` beside the sub-nav.

- [ ] **Step 1: Messages**

`es.json`:

```json
  "cycles_title": "Convocatorias",
  "cycles_new": "Nueva convocatoria",
  "cycles_name": "Nombre",
  "cycles_name_help": "Dos años seguidos: 2027-2028.",
  "cycles_window": "Ventana de registro",
  "cycles_review": "Fecha de revisión",
  "cycles_create": "Crear",
  "cycles_save": "Guardar cambios",
  "cycles_activate": "Hacer actual",
  "cycles_active": "actual",
  "cycles_edit": "Editar",
  "cycles_history": "Cambios",
  "cycles_history_none": "Sin cambios registrados.",
  "cycles_changed_by": "{name} · {when}",
  "cycles_select_label": "Convocatoria",
  "cycles_created": "Convocatoria creada.",
  "cycles_saved": "Cambios guardados.",
  "cycles_activated": "Ahora es la convocatoria actual.",
```

`en.json`:

```json
  "cycles_title": "Calls for applications",
  "cycles_new": "New call",
  "cycles_name": "Name",
  "cycles_name_help": "Two consecutive years: 2027-2028.",
  "cycles_window": "Registration window",
  "cycles_review": "Review date",
  "cycles_create": "Create",
  "cycles_save": "Save changes",
  "cycles_activate": "Make current",
  "cycles_active": "current",
  "cycles_edit": "Edit",
  "cycles_history": "Changes",
  "cycles_history_none": "No changes recorded.",
  "cycles_changed_by": "{name} · {when}",
  "cycles_select_label": "Call for applications",
  "cycles_created": "Call created.",
  "cycles_saved": "Changes saved.",
  "cycles_activated": "It is now the current call.",
```

- [ ] **Step 2: Search param and hook**

In `src/routes/administracion.tsx` add to the route options:

```ts
  validateSearch: (search: Record<string, unknown>): { ciclo?: string } =>
    typeof search.ciclo === 'string' && /^\d{4}-\d{4}$/.test(search.ciclo) ? { ciclo: search.ciclo } : {},
```

```ts
// src/hooks/useAdminCycle.ts
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Which call the admin pages look at. Lives in the URL (`?ciclo=`) so a link
 * to last year's table opens last year's table; defaults to the active one.
 */
export function useAdminCycle() {
  const { ciclo } = useSearch({ from: '/administracion' })
  const navigate = useNavigate({ from: '/administracion' })
  const cycles = useQuery(api.cycles.list)
  const cycle = ciclo ?? cycles?.find((c) => c.isActive)?.cycle
  return {
    cycle,
    cycles,
    setCycle: (c: string) => void navigate({ search: { ciclo: c }, replace: true }),
  }
}
```

- [ ] **Step 3: `CycleSelect.tsx` and the shell**

```tsx
// src/components/Admin/CycleSelect.tsx
import * as m from '../../paraglide/messages.js'
import { useAdminCycle } from '../../hooks/useAdminCycle'

export default function CycleSelect() {
  const { cycle, cycles, setCycle } = useAdminCycle()
  if (!cycles || cycles.length < 2) return null
  return (
    <label className="flex items-center gap-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
      {m.cycles_select_label()}
      <select className="fld-input w-auto py-1.5 font-mono text-[11.5px]" value={cycle ?? ''} onChange={(e) => setCycle(e.target.value)}>
        {cycles.map((c) => (
          <option key={c.cycle} value={c.cycle}>
            {c.cycle}{c.isActive ? ` · ${m.cycles_active()}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
```

In `AdminShell.tsx`: restore `/administracion/convocatorias` in `NAV`, wrap the `<nav>` and `<CycleSelect />` in `<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">` (move the border classes off the `<nav>`).

- [ ] **Step 4: `CycleForm.tsx`**

```tsx
// src/components/Admin/CycleForm.tsx
import { useState } from 'react'
import * as m from '../../paraglide/messages.js'
import DateField from '../DateField'
import RangeField from '../DateField/RangeField'
import { validateCycle } from '../../../convex/lib/cycleRules'
import type { CycleInput } from '../../../convex/lib/cycleRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'

type Props = {
  initial?: CycleInput
  /** The name is the key; editing an existing row keeps it read-only. */
  lockName?: boolean
  submitLabel: string
  onSubmit: (input: CycleInput) => Promise<void>
  onDone?: () => void
}

export default function CycleForm({ initial, lockName, submitLabel, onSubmit, onDone }: Props) {
  const [cycle, setCycle] = useState(initial?.cycle ?? '')
  const [opensOn, setOpensOn] = useState(initial?.opensOn ?? '')
  const [closesOn, setClosesOn] = useState(initial?.closesOn ?? '')
  const [reviewOn, setReviewOn] = useState(initial?.reviewOn ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const input = { cycle: cycle.trim(), opensOn, closesOn, reviewOn }
    const problem = validateCycle(input)
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(input)
      onDone?.()
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card mt-6 max-w-[62ch] px-[21px] py-[19px]">
      <label htmlFor="cycle-name" className="text-[12.5px] font-medium">
        {m.cycles_name()} <span className="text-bad">*</span>
      </label>
      <input
        id="cycle-name"
        className="fld-input mt-1.5 font-mono tracking-[0.04em]"
        value={cycle}
        onChange={(e) => setCycle(e.target.value)}
        disabled={lockName}
        placeholder="2027-2028"
      />
      <p className="mt-1 mb-4 text-[11.5px] text-soft">{m.cycles_name_help()}</p>

      <RangeField
        id="cycle-window"
        label={m.cycles_window()}
        start={opensOn}
        end={closesOn}
        onChange={({ start, end }) => {
          setOpensOn(start)
          setClosesOn(end)
        }}
        min={`${new Date().getUTCFullYear() - 1}-01-01`}
        max={`${new Date().getUTCFullYear() + 5}-12-31`}
      />

      <div className="mt-4">
        <DateField
          id="cycle-review"
          label={m.cycles_review()}
          req
          value={reviewOn}
          onChange={setReviewOn}
          min={closesOn || undefined}
          max={`${new Date().getUTCFullYear() + 5}-12-31`}
        />
      </div>

      <p className="min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
      <button type="submit" className="btn" disabled={busy}>
        {busy ? m.common_loading() : submitLabel}
      </button>
    </form>
  )
}
```

(`DateField` opens eighteen years back by default — for a review date that is wrong. Give `DateField` an optional `openAt?: string` prop, defaulting to the existing eighteen-years-back, and pass `openAt={closesOn || undefined}` here. One-line change in `DateField/index.tsx`: `openAt={parseISO(openAt ?? '') ?? { y: today.y - 18, m: today.m, d: today.d }}`.)

- [ ] **Step 5: `CyclesPanel.tsx` and the route**

```tsx
// src/components/Admin/CyclesPanel.tsx
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import CycleForm from './CycleForm'
import { useDateFormats } from '../DateField/format'
import { describeConvexError } from '../../lib/registrationErrors'

export default function CyclesPanel() {
  const cycles = useQuery(api.cycles.list)
  const create = useMutation(api.cycles.create)
  const update = useMutation(api.cycles.update)
  const setActive = useMutation(api.cycles.setActive)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fmt = useDateFormats()

  if (cycles === undefined) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="h-display text-[18px]">{m.cycles_title()}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating((c) => !c)}>
          {m.cycles_new()}
        </button>
        {notice && <span className="text-[12.5px] text-soft">{notice}</span>}
      </div>

      {creating && (
        <CycleForm
          submitLabel={m.cycles_create()}
          onSubmit={async (input) => {
            await create(input)
            setNotice(m.cycles_created())
          }}
          onDone={() => setCreating(false)}
        />
      )}

      <ul className="mt-4 grid gap-3">
        {cycles.map((c) => (
          <li key={c.cycle} className="card px-[21px] py-[15px]">
            <div className="flex flex-wrap items-center gap-3">
              <b className="font-disp text-[15px]">{c.cycle}</b>
              {c.isActive && <span className="chip chip-y">{m.cycles_active()}</span>}
              <span className="font-mono text-[11px] text-soft">
                {c.opensOn} → {c.closesOn} · {m.cycles_review()}: {c.reviewOn}
              </span>
              <span className="ml-auto flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(editing === c.cycle ? null : c.cycle)}>
                  {m.cycles_edit()}
                </button>
                {!c.isActive && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await setActive({ cycle: c.cycle })
                        setNotice(m.cycles_activated())
                      } catch (err) {
                        setNotice(describeConvexError(err))
                      }
                    }}
                  >
                    {m.cycles_activate()}
                  </button>
                )}
              </span>
            </div>
            {editing === c.cycle && (
              <>
                <CycleForm
                  initial={c}
                  lockName
                  submitLabel={m.cycles_save()}
                  onSubmit={async (input) => {
                    await update(input)
                    setNotice(m.cycles_saved())
                  }}
                  onDone={() => setEditing(null)}
                />
                <History cycle={c.cycle} format={(ms) => fmt.full.format(new Date(ms))} />
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function History({ cycle, format }: { cycle: string; format: (ms: number) => string }) {
  const changes = useQuery(api.cycles.changes, { cycle })
  if (!changes) return null
  return (
    <div className="mt-4">
      <p className="eyebrow">{m.cycles_history()}</p>
      {changes.length === 0 && <p className="mt-1 text-[12.5px] text-soft">{m.cycles_history_none()}</p>}
      <ul className="mt-1 grid gap-1 font-mono text-[11px] text-soft">
        {changes.map((ch, i) => (
          <li key={i}>
            {m.cycles_changed_by({ name: ch.changedByName, when: format(ch.changedAt) })}
            {' · '}
            {ch.before ? `${ch.before.opensOn}→${ch.before.closesOn}${ch.before.isActive ? ' *' : ''}` : '—'}
            {' ⇒ '}
            {`${ch.after.opensOn}→${ch.after.closesOn}${ch.after.isActive ? ' *' : ''}`}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```tsx
// src/routes/administracion.convocatorias.tsx
import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import CyclesPanel from '../components/Admin/CyclesPanel'
import NoTools from '../components/Admin/NoTools'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'

export const Route = createFileRoute('/administracion/convocatorias')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.cycles_title() }) }] }),
  component: () => {
    const me = useMe()
    if (!me) return null
    return can(me.roles, 'manage_cycles') ? <CyclesPanel /> : <NoTools />
  },
})
```

- [ ] **Step 6: Generate, check, verify**

Run: `npm run generate-routes && npm run check`
Expected: green.

In the browser as master_admin: `/es/administracion/convocatorias` lists `2026-2027 · actual`. Create `2027-2028` with a window in September 2027 (the grid tints the days between) and a review date after it. It appears inactive; the selector now shows in the shell. "Editar" on 2026-2027, move `closesOn` to the 19th, save → the landing page footer reads "cierra el 19 de septiembre de 2026" and the history lists your change with your name. Move it back. "Hacer actual" on 2027-2028 → landing says it opens in 2027; switch back.

- [ ] **Step 7: Commit**

```bash
git add src/routes/administracion.convocatorias.tsx src/routes/administracion.tsx src/components/Admin src/hooks/useAdminCycle.ts src/components/DateField/index.tsx src/routeTree.gen.ts messages/es.json messages/en.json
git commit -m "feat(admin): cycles screen with range picker, activation, and change history

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Docs and PR

**Files:**
- Modify: `docs/DECISIONS.md`, `README.md`, `docs/DEPLOYMENT.md`

- [ ] **Step 1: `docs/DECISIONS.md`**

Replace the first "## Product" paragraph with:

```markdown
**The window lives in the `cycles` table, one row per call, exactly one
active.** A `master_admin` edits opens/closes/review from
`/administracion/convocatorias`; every change lands in `cycleChanges` with who
and when. The 2026–2027 row was seeded from the old constants (September 4–18,
review the 23rd). The arithmetic — Mexico City days to instants, UTC-6 all
year — is `convex/lib/cycleRules.ts`, shared with the client. There is no
development hatch anymore: to test before September, set dev dates on the dev
row.
```

Under "## Editable until the close, then frozen", replace "Mexico has not observed…constants are stored in UTC." with "Mexico has not observed daylight saving time since 2022, so `America/Mexico_City` is UTC-6 all year and `cycleRules.ts` turns the stored days into instants with that fixed offset."

- [ ] **Step 2: `README.md`**

Remove the `VITE_WINDOW_ALWAYS_OPEN` row from the variables table and the `--build-arg` for it if present. Under "## Getting started", add after step 1 (Convex):

```markdown
Then seed the call for applications, once per deployment:

```bash
npx convex run cycles:seed
```

Without an active cycle every registration query fails with `no_active_cycle`.
```

- [ ] **Step 3: `docs/DEPLOYMENT.md`**

Delete the "And one that must NOT exist in production" block and the `WINDOW_ALWAYS_OPEN` checklist lines (Convex and Container sections). Add to the Convex checklist: `- [ ] \`npx convex run cycles:seed --prod\` run; the \`cycles\` table shows 2026-2027 active`. In §4 note that the window can be moved from `/administracion/convocatorias` by a `master_admin`.

- [ ] **Step 4: Check, commit, PR**

Run: `npm run check`
Expected: green.

```bash
git add docs/DECISIONS.md README.md docs/DEPLOYMENT.md
git commit -m "docs: the window lives in the cycles table; dev hatch retired

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin feat/cycles-and-window
gh pr create --title "feat: cycles table, editable window, range picker" --body "$(cat <<'EOF'
## Summary
- `cycles` + `cycleChanges` tables; `cycles:seed` inserts 2026–2027 (run in dev and prod)
- Convex and the client read the active cycle; `OPENS_AT_MS`/`CLOSES_AT_MS`/`REVIEW_DATE`/`CURRENT_CYCLE` and `WINDOW_ALWAYS_OPEN` are gone
- every date in copy and emails is interpolated from the row
- `RangeField` on the existing calendar grid; `/administracion/convocatorias` with create / edit / set active / history; cycle selector in the admin shell

Spec: docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md §3

## Test plan
- [ ] `npm run check`
- [ ] landing, sign-up, panel, bases, emails show the row's dates in both locales
- [ ] editing `closesOn` in the screen updates the landing page live and writes a history row
- [ ] `setActive` swaps which cycle the landing page talks about
- [ ] `grep -rn WINDOW_ALWAYS_OPEN .` finds nothing outside git history

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage.** §3 tables (T2), rules (T1), current cycle/setActive (T2), constants removed + `activeCycle` (T3), seed before deploy (T2), hatch deleted (T3, T7), copy interpolated (T4), range picker (T5), `manage_cycles` + audit (T2, T6), §4 `convocatorias` route and cycle selector (T6). Docs (T7).

**Placeholders.** None. The module-cycle fix (`convex/auth.ts`) in T3 step 7 is prescribed, not deferred.

**Type consistency.** `activeCycle(ctx)` / `requireWindowOpen(ctx)` (T2) used in T3; `windowOf` returns `{ opensAtMs, closesAtMs }` everywhere; `useActiveCycle()` fields `title, opensOnText, closesOnText, reviewOnText, isOpen, beforeOpening, cycle` used in T4; `RegistrationForm.closesOnText` (T4) is the prop Plan 3/4 keep passing; `useAdminCycle().cycle` (T6) is what Plan 3's table reads.
