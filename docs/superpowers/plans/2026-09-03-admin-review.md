# Admin Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give administration the three registration views, a single-page detail with a decision panel, the `selected` / `not_selected` stage for the Council, and the three decision emails with individual and batch sending.

**Architecture:** `convex/lib/decisionRules.ts` owns the state machine (which transitions, which permission, when a note is required, when a sent notice locks the decision) and the `sectionsComplete` measure; `registrations.decide` is a thin caller. One reactive query returns every row of the cycle with computed columns; TanStack Table v9 sorts and selects client-side over a pre-filtered array. Notices are a sub-document updated by the Resend webhook already wired in `emails.recordEmailEvent`.

**Tech Stack:** Convex 1.45, `@convex-dev/resend`, `@tanstack/react-table` 9.x, TanStack Start/Router 1.x, React 19, Paraglide 2.24, Vitest 3.2.

**Spec:** [`docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md`](../specs/2026-09-03-admin-roles-cycles-review-design.md) §4, §5, §6. Requires Plans 1 and 2 merged: `requirePermission`, `AdminShell`, `useMe`, `useAdminCycle`, `activeCycle`.

## Global Constraints

- **Branch:** `feat/admin-review`, cut from `main` after Plan 2 merges. One PR. `npm run check` green before every commit.
- **Rules modules import nothing** from `convex/_generated`, `convex/values`, or Paraglide.
- **Convex thrown errors** are `ConvexError({ code })`; every new code gets `es` + `en` messages and a `MESSAGES` entry.
- **No internal note ever enters an email body.** The three bodies are fixed copy; `validationNote` and `decisionLog` are for staff.
- **Emails go to the account address** (`users.email`), never `personal.email` from the form.
- **Batch sending refuses while the active window is open.** Checked on the server, not just in the UI.
- **Colour is never the only signal.** Every chip carries a word.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

---

## File structure

| File | Responsibility |
|---|---|
| `convex/lib/decisionRules.ts` | Transitions, permissions per decision, note/guardian/lock rules, `sectionsComplete`. Pure. |
| `convex/schema.ts` | Statuses, `decisionLog`, `decisionNotice`, `by_notice_email` index. |
| `convex/registrations.ts` | `listForAdmin({ cycle })`, `detail({ id })`, `decide(...)`; old `review` removed. |
| `convex/emails.ts` | Three decision templates, `sendDecisionNotice`, notice status from `recordEmailEvent`. |
| `convex/notices.ts` | `sendRejection`, `sendBatch`, `sendTest`. |
| `src/lib/adminViews.ts` | View presets and the client filter. Pure. |
| `src/components/Admin/RegistrationsTable.tsx`, `RegistrationFilters.tsx`, `BatchSendDialog.tsx`, `StatusChip.tsx` | The table page. |
| `src/components/Admin/RegistrationDetail.tsx`, `DecisionPanel.tsx`, `ReadSection.tsx` | The detail page. |
| `src/routes/administracion.registros.tsx`, `src/routes/administracion.registros.$id.tsx` | Routes. |
| `src/components/Admin/AdminShell.tsx`, `src/routes/administracion.index.tsx` | Nav entry, index prefers registrations. |
| `docs/DEPLOYMENT.md` §4, `docs/DECISIONS.md` | Amended. |
| `tests/decisionRules.test.ts`, `tests/adminViews.test.ts`, `tests/components/RegistrationsTable.test.tsx`, `tests/components/DecisionPanel.test.tsx` | Tests. |

---

### Task 1: Decision rules module

**Files:**
- Create: `convex/lib/decisionRules.ts`
- Modify: `convex/lib/errorCodes.ts`, `messages/es.json`, `messages/en.json`, `src/lib/registrationErrors.ts`
- Test: `tests/decisionRules.test.ts`

**Interfaces:**
- Produces:
  - `type Decision = 'validated' | 'rejected' | 'selected' | 'not_selected'`
  - `const DECISIONS: readonly Decision[]`
  - `type RegistrationStatus = 'draft' | 'submitted' | Decision`
  - `type NoticeDecision = 'rejected' | 'selected' | 'not_selected'`
  - `type NoticeStatus = 'not_sent' | 'sent' | 'delivered' | 'bounced'`
  - `function permissionFor(decision: Decision): Permission` — `validated|rejected → 'review_registrations'`, else `'select_registrations'`.
  - `function checkDecision(input: { from: RegistrationStatus; to: Decision; note?: string; guardianConfirmed: boolean; noticeStatus: NoticeStatus | null; permissions: readonly Permission[] }): AppErrorCode | null`
  - `function noticeDecisionFor(status: RegistrationStatus): NoticeDecision | null` — `validated`, `draft`, `submitted` → null.
  - `const SECTIONS_TOTAL = 7`
  - `function sectionsComplete(data: RegistrationData): number`
- New codes: `decision_invalid`, `note_required`, `guardian_unconfirmed`, `decision_locked`, `notice_not_pending`, `registration_not_found`, `nothing_to_send`.

- [ ] **Step 1: Codes and messages**

`errorCodes.ts` `ActionErrorCode`, before `'generic'`:

```ts
  // Decisions and notices.
  | 'decision_invalid'
  | 'note_required'
  | 'guardian_unconfirmed'
  | 'decision_locked'
  | 'notice_not_pending'
  | 'registration_not_found'
  | 'nothing_to_send'
```

`es.json`:

```json
  "err_decision_invalid": "Ese cambio de estado no está permitido.",
  "err_note_required": "Escribe una nota: explica el motivo.",
  "err_guardian_unconfirmed": "No se puede seleccionar a una persona menor de edad sin la autorización de su tutor.",
  "err_decision_locked": "Ya se envió el correo con esta decisión. Solo administración maestra puede cambiarla, con nota.",
  "err_notice_not_pending": "Ese correo ya se envió.",
  "err_registration_not_found": "No encontramos ese registro.",
  "err_nothing_to_send": "No hay correos pendientes en la selección.",
```

`en.json`:

```json
  "err_decision_invalid": "That status change isn't allowed.",
  "err_note_required": "Write a note explaining the reason.",
  "err_guardian_unconfirmed": "A minor can't be selected without their guardian's authorization.",
  "err_decision_locked": "The email for this decision was already sent. Only a master admin can change it, with a note.",
  "err_notice_not_pending": "That email was already sent.",
  "err_registration_not_found": "We couldn't find that registration.",
  "err_nothing_to_send": "There are no pending emails in the selection.",
```

`MESSAGES` additions:

```ts
  decision_invalid: m.err_decision_invalid,
  note_required: m.err_note_required,
  guardian_unconfirmed: m.err_guardian_unconfirmed,
  decision_locked: m.err_decision_locked,
  notice_not_pending: m.err_notice_not_pending,
  registration_not_found: m.err_registration_not_found,
  nothing_to_send: m.err_nothing_to_send,
```

- [ ] **Step 2: Failing tests**

```ts
// tests/decisionRules.test.ts
import { describe, expect, it } from 'vitest'
import {
  SECTIONS_TOTAL,
  checkDecision,
  noticeDecisionFor,
  permissionFor,
  sectionsComplete,
} from '../convex/lib/decisionRules'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import type { RegistrationData } from '../convex/lib/registrationSchema'

const REVIEWER = ['review_registrations', 'send_rejection', 'view_staff'] as const
const MASTER = [
  'review_registrations', 'send_rejection', 'select_registrations',
  'send_batch', 'view_staff', 'manage_users', 'manage_cycles',
] as const

const base = { guardianConfirmed: true, noticeStatus: null, permissions: REVIEWER }

describe('permissionFor', () => {
  it('splits screening from selection', () => {
    expect(permissionFor('validated')).toBe('review_registrations')
    expect(permissionFor('rejected')).toBe('review_registrations')
    expect(permissionFor('selected')).toBe('select_registrations')
    expect(permissionFor('not_selected')).toBe('select_registrations')
  })
})

describe('checkDecision', () => {
  it('lets a reviewer validate a submitted registration', () => {
    expect(checkDecision({ ...base, from: 'submitted', to: 'validated' })).toBeNull()
  })

  it('never decides a draft', () => {
    expect(checkDecision({ ...base, from: 'draft', to: 'validated' })).toBe('decision_invalid')
  })

  it('wants a note on every rejection', () => {
    expect(checkDecision({ ...base, from: 'submitted', to: 'rejected' })).toBe('note_required')
    expect(checkDecision({ ...base, from: 'submitted', to: 'rejected', note: '  ' })).toBe('note_required')
    expect(checkDecision({ ...base, from: 'submitted', to: 'rejected', note: 'Fuera de edad.' })).toBeNull()
  })

  it('wants a note when a prior decision changes', () => {
    expect(checkDecision({ ...base, from: 'validated', to: 'rejected', note: 'x' })).toBeNull()
    expect(checkDecision({ ...base, from: 'rejected', to: 'validated' })).toBe('note_required')
  })

  it('needs select_registrations to select, and only from validated', () => {
    expect(checkDecision({ ...base, from: 'validated', to: 'selected' })).toBe('permission_required')
    expect(checkDecision({ ...base, permissions: MASTER, from: 'validated', to: 'selected' })).toBeNull()
    expect(checkDecision({ ...base, permissions: MASTER, from: 'submitted', to: 'selected' })).toBe('decision_invalid')
  })

  /** DECISIONS open item 2, closed: validate yes, select never, without the guardian. */
  it('lets a guardian-pending registration be validated but not selected', () => {
    expect(checkDecision({ ...base, guardianConfirmed: false, from: 'submitted', to: 'validated' })).toBeNull()
    expect(
      checkDecision({ ...base, permissions: MASTER, guardianConfirmed: false, from: 'validated', to: 'selected' }),
    ).toBe('guardian_unconfirmed')
  })

  it('locks a decision once its notice went out, except for a master admin with a note', () => {
    expect(checkDecision({ ...base, noticeStatus: 'sent', from: 'rejected', to: 'validated', note: 'x' })).toBe(
      'decision_locked',
    )
    expect(
      checkDecision({ ...base, permissions: MASTER, noticeStatus: 'sent', from: 'rejected', to: 'validated' }),
    ).toBe('note_required')
    expect(
      checkDecision({ ...base, permissions: MASTER, noticeStatus: 'delivered', from: 'rejected', to: 'validated', note: 'x' }),
    ).toBeNull()
  })

  it('treats not_sent as not locked', () => {
    expect(checkDecision({ ...base, noticeStatus: 'not_sent', from: 'rejected', to: 'validated', note: 'x' })).toBeNull()
  })
})

describe('noticeDecisionFor', () => {
  it('maps the three states that get an email, and nothing else', () => {
    expect(noticeDecisionFor('rejected')).toBe('rejected')
    expect(noticeDecisionFor('selected')).toBe('selected')
    expect(noticeDecisionFor('not_selected')).toBe('not_selected')
    expect(noticeDecisionFor('validated')).toBeNull()
    expect(noticeDecisionFor('submitted')).toBeNull()
  })
})

describe('sectionsComplete', () => {
  function complete(): RegistrationData {
    const d = emptyRegistration({
      name: 'Ana Gómez', email: 'ana@example.com', whatsapp: '5512345678',
      birthDate: '2008-04-11', branch: 'womens', state: 'Nuevo León', city: 'Monterrey',
    })
    d.academic.school = 'ITESM'
    d.academic.grade = '11'
    d.athletic = { club: 'Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true }
    d.results = [1, 2, 3, 4].map((i) => ({ tournament: `T${i}`, result: '1' }))
    d.rankings = [{ name: 'CNIJ', position: '12' }]
    d.motivationLetter = 'Quiero jugar.'
    d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
    return d
  }

  it('is 7 of 7 for a registration that passes every rule', () => {
    expect(SECTIONS_TOTAL).toBe(7)
    expect(sectionsComplete(complete())).toBe(7)
  })

  it('is 0 for an empty one', () => {
    expect(sectionsComplete(emptyRegistration())).toBe(0)
  })

  it('counts a section only when its rules pass, not when it has text', () => {
    const d = complete()
    d.results = [{ tournament: 'Solo uno', result: '1' }] // rules want four
    expect(sectionsComplete(d)).toBe(6)
  })

  it('ignores the calendar: an optional step cannot be owed', () => {
    const d = complete()
    d.calendar = []
    expect(sectionsComplete(d)).toBe(7)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/decisionRules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the module**

```ts
// convex/lib/decisionRules.ts
import type { AppErrorCode } from './errorCodes'
import type { Permission } from './permissions'
import { validateRegistration, type RegistrationFieldPath } from './registrationRules'
import type { RegistrationData } from './registrationSchema'

/**
 * The decisions a registration can carry and who may make them. Two stages:
 * administration screens (`validated` / `rejected`), the Council — by a
 * master_admin's hand — selects (`selected` / `not_selected`). The acceptance
 * email is about selection, and sending "accepted" to two hundred screened
 * people who then do not make twenty-five is the worst email this system
 * could send.
 */

export type Decision = 'validated' | 'rejected' | 'selected' | 'not_selected'
export const DECISIONS: readonly Decision[] = ['validated', 'rejected', 'selected', 'not_selected']
export type RegistrationStatus = 'draft' | 'submitted' | Decision

export type NoticeDecision = 'rejected' | 'selected' | 'not_selected'
export type NoticeStatus = 'not_sent' | 'sent' | 'delivered' | 'bounced'

export function permissionFor(decision: Decision): Permission {
  return decision === 'validated' || decision === 'rejected'
    ? 'review_registrations'
    : 'select_registrations'
}

/** What may follow what. Changing a prior decision is allowed (with a note). */
const NEXT: Record<RegistrationStatus, readonly Decision[]> = {
  draft: [],
  submitted: ['validated', 'rejected'],
  validated: ['rejected', 'selected', 'not_selected'],
  rejected: ['validated'],
  selected: ['not_selected', 'validated', 'rejected'],
  not_selected: ['selected', 'validated', 'rejected'],
}

const isDecided = (s: RegistrationStatus): s is Decision => s !== 'draft' && s !== 'submitted'

export function checkDecision(input: {
  from: RegistrationStatus
  to: Decision
  note?: string
  guardianConfirmed: boolean
  noticeStatus: NoticeStatus | null
  permissions: readonly Permission[]
}): AppErrorCode | null {
  const { from, to } = input
  if (!NEXT[from].includes(to)) return 'decision_invalid'

  const locked = input.noticeStatus !== null && input.noticeStatus !== 'not_sent'
  // A sent notice is a promise made to a family. Only a master_admin may
  // unmake it, and only with a reason on file.
  const needs: Permission = locked ? 'select_registrations' : permissionFor(to)
  if (!input.permissions.includes(needs)) {
    return locked ? 'decision_locked' : 'permission_required'
  }

  if (to === 'selected' && !input.guardianConfirmed) return 'guardian_unconfirmed'

  const hasNote = (input.note ?? '').trim().length > 0
  if ((to === 'rejected' || isDecided(from)) && !hasNote) return 'note_required'

  return null
}

export function noticeDecisionFor(status: RegistrationStatus): NoticeDecision | null {
  return status === 'rejected' || status === 'selected' || status === 'not_selected' ? status : null
}

/**
 * The seven required steps, by the fields each renders. Calendar (step 6) is
 * the only step with no rule, so it is not here: the measure exists to find
 * people who still owe something, and an optional step cannot be owed.
 */
const SECTIONS: readonly (readonly RegistrationFieldPath[])[] = [
  ['personal.name', 'personal.email', 'personal.whatsapp', 'personal.birthDate', 'personal.branch', 'personal.state', 'personal.city'],
  ['academic.school', 'academic.grade', 'academic.graduationYear'],
  ['athletic.club', 'athletic.coach', 'athletic.ghin'],
  ['results'],
  ['rankings'],
  ['motivationLetter'],
  ['confirmations.rules', 'confirmations.scholarshipUnderstood', 'confirmations.privacy'],
]

export const SECTIONS_TOTAL = SECTIONS.length

/** How many of the seven required sections pass their rules. */
export function sectionsComplete(data: RegistrationData): number {
  const failing = new Set(validateRegistration(data).map((e) => e.field))
  return SECTIONS.filter((fields) => fields.every((f) => !failing.has(f))).length
}
```

(`RegistrationFieldPath` and the exact field names come from `convex/lib/registrationRules.ts`; if a path there differs — e.g. `academic.graduationYear` is not a reported field — drop it from `SECTIONS`, the test for "6 of 7" still holds.)

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/decisionRules.test.ts && npm run typecheck`
Expected: PASS (14 tests).

- [ ] **Step 6: Commit**

```bash
git add convex/lib/decisionRules.ts convex/lib/errorCodes.ts messages src/lib/registrationErrors.ts tests/decisionRules.test.ts
git commit -m "feat(review): decision state machine and sections-complete measure

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Schema, `listForAdmin`, `detail`, `decide`

**Files:**
- Modify: `convex/schema.ts`, `convex/registrations.ts`

**Interfaces:**
- Schema: `vRegistrationStatus` gains `selected`, `not_selected`; `registrations` gains `decisionLog?`, `decisionNotice?`, `wasMinorAtCycleStart?` (Plan 4 writes it; declared now so one schema change covers both) and index `by_notice_email` on `['decisionNotice.emailId']`.
- `registrations.listForAdmin({ cycle })` → `AdminRow[]` with
  `{ _id, status, submittedAt?, updatedAt, name, email, branch, state, isMinor, guardianRequired, guardianConfirmed, sectionsComplete, notice: NoticeStatus | null, decision: NoticeDecision | null }`.
- `registrations.detail({ id })` → `{ registration: Doc<'registrations'>, account: { email, emailVerified, birthDate?, wasMinorAtSignup? }, guardian: { required, confirmed, guardianName?, guardianEmail?, timesSent? }, log: Array<{ status, at, byName, note? }>, sectionsComplete }`.
- `registrations.decide({ id, decision, note? })` → `{ ok: true }`.
- `registrations.review` removed.

- [ ] **Step 1: Schema**

```ts
export const vRegistrationStatus = v.union(
  v.literal('draft'),
  v.literal('submitted'),
  v.literal('validated'),
  v.literal('rejected'),
  v.literal('selected'),
  v.literal('not_selected'),
)

export const vDecision = v.union(
  v.literal('validated'),
  v.literal('rejected'),
  v.literal('selected'),
  v.literal('not_selected'),
)

const vNoticeDecision = v.union(v.literal('rejected'), v.literal('selected'), v.literal('not_selected'))
const vNoticeStatus = v.union(
  v.literal('not_sent'),
  v.literal('sent'),
  v.literal('delivered'),
  v.literal('bounced'),
)
```

In the `registrations` table, after `validationNote`:

```ts
    /** Every decision ever made on this registration, newest last. */
    decisionLog: v.optional(
      v.array(
        v.object({
          status: vDecision,
          by: v.id('users'),
          at: v.number(),
          note: v.optional(v.string()),
        }),
      ),
    ),
    /**
     * The email that tells the athlete. `not_sent` until someone presses the
     * button; then the Resend webhook moves it to delivered or bounced. A
     * decision whose notice went out is locked — see decisionRules.ts.
     */
    decisionNotice: v.optional(
      v.object({
        decision: vNoticeDecision,
        status: vNoticeStatus,
        emailId: v.optional(v.string()),
        sentAt: v.optional(v.number()),
        sentBy: v.optional(v.id('users')),
      }),
    ),
    /** Age at the cycle's opening day. Written by the first save in a cycle (see users.wasMinorAtSignup for the frozen signup value). */
    wasMinorAtCycleStart: v.optional(v.boolean()),
```

and the index `.index('by_notice_email', ['decisionNotice.emailId'])`.

- [ ] **Step 2: `listForAdmin`, `detail`, `decide`**

Replace the "Administration" block at the end of `convex/registrations.ts` with:

```ts
// ---------------------------------------------------------------------------
// Administration.
// ---------------------------------------------------------------------------

import { checkDecision, noticeDecisionFor, sectionsComplete } from './lib/decisionRules'
import { permissionsOf } from './lib/permissions'
import { vDecision } from './schema'

/** Every registration of one cycle, with the columns the table sorts on. */
export const listForAdmin = query({
  args: { cycle: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'review_registrations')

    const rows = await ctx.db
      .query('registrations')
      .withIndex('by_cycle_status', (q) => q.eq('cycle', args.cycle))
      .collect()

    const out = []
    for (const r of rows) {
      const user = await ctx.db.get(r.userId)
      const guardian = await ctx.db
        .query('guardianAuth')
        .withIndex('by_user_cycle', (q) => q.eq('userId', r.userId).eq('cycle', args.cycle))
        .unique()
      out.push({
        _id: r._id,
        status: r.status,
        submittedAt: r.submittedAt,
        updatedAt: r.updatedAt,
        name: r.personal.name || user?.name || user?.email || '',
        email: user?.email ?? '',
        branch: r.personal.branch,
        state: r.personal.state,
        isMinor: r.wasMinorAtCycleStart ?? user?.wasMinorAtSignup ?? false,
        guardianRequired: guardian !== null,
        guardianConfirmed: guardian === null || guardian.confirmedAt !== undefined,
        sectionsComplete: sectionsComplete(r),
        notice: r.decisionNotice?.status ?? null,
        decision: r.decisionNotice?.decision ?? null,
      })
    }
    return out
  },
})

export const detail = query({
  args: { id: v.id('registrations') },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'review_registrations')
    const r = await ctx.db.get(args.id)
    if (!r) fail('registration_not_found')
    const user = await ctx.db.get(r.userId)
    const guardian = await ctx.db
      .query('guardianAuth')
      .withIndex('by_user_cycle', (q) => q.eq('userId', r.userId).eq('cycle', r.cycle))
      .unique()

    const log = []
    for (const entry of r.decisionLog ?? []) {
      const by = await ctx.db.get(entry.by)
      log.push({ status: entry.status, at: entry.at, byName: by?.name ?? by?.email ?? '', note: entry.note })
    }

    return {
      registration: r,
      account: {
        email: user?.email ?? '',
        emailVerified: user?.emailVerified ?? false,
        birthDate: user?.birthDate,
        wasMinorAtSignup: user?.wasMinorAtSignup,
      },
      guardian: guardian
        ? {
            required: true,
            confirmed: guardian.confirmedAt !== undefined,
            guardianName: guardian.guardianName,
            guardianEmail: guardian.guardianEmail,
            timesSent: guardian.timesSent,
          }
        : { required: false, confirmed: true },
      log,
      sectionsComplete: sectionsComplete(r),
    }
  },
})

/**
 * One mutation for every decision. The rules decide whether this actor may
 * make this move; this only writes what they allow. A change that lands on a
 * state with an email resets the notice to `not_sent` and never sends — a
 * correction email deserves a human pressing the button.
 */
export const decide = mutation({
  args: { id: v.id('registrations'), decision: vDecision, note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx)
    const r = await ctx.db.get(args.id)
    if (!r) fail('registration_not_found')
    const guardian = await ctx.db
      .query('guardianAuth')
      .withIndex('by_user_cycle', (q) => q.eq('userId', r.userId).eq('cycle', r.cycle))
      .unique()

    const problem = checkDecision({
      from: r.status,
      to: args.decision,
      note: args.note,
      guardianConfirmed: guardian === null || guardian.confirmedAt !== undefined,
      noticeStatus: r.decisionNotice?.status ?? null,
      permissions: permissionsOf(actor.roles),
    })
    if (problem) fail(problem)

    const now = Date.now()
    const note = args.note?.trim() || undefined
    const nextNotice = noticeDecisionFor(args.decision)
    await ctx.db.patch(r._id, {
      status: args.decision,
      validatedBy: actor._id,
      validatedAt: now,
      validationNote: note,
      decisionLog: [...(r.decisionLog ?? []), { status: args.decision, by: actor._id, at: now, note }],
      decisionNotice: nextNotice ? { decision: nextNotice, status: 'not_sent' } : undefined,
    })
    return { ok: true as const }
  },
})
```

Move the three imports to the top of the file with the others. `fail`'s type in this file is `ActionErrorCode` — fine. Delete the old `review` mutation and the `requireAdmin`-era comment.

- [ ] **Step 3: Check and push**

Run: `npm run check && npx convex dev --once`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/registrations.ts
git commit -m "feat(review): selection statuses, decision log and notice, admin list/detail/decide

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Decision emails and `notices.ts`

**Files:**
- Modify: `convex/emails.ts`
- Create: `convex/notices.ts`

**Interfaces:**
- `emails.sendDecisionNotice` internal `{ registrationId, sentBy }` — reads the row, sends the copy for `decisionNotice.decision`, patches `{ status: 'sent', emailId, sentAt, sentBy }`.
- `emails.sendDecisionTest` internal `{ to, decision, cycleTitle }` — the same body to any address, no row.
- `emails.recordEmailEvent` also moves a registration's notice to `delivered` / `bounced` by `emailId`.
- `notices.sendRejection({ id })` (`send_rejection`) → `{ ok: true }`.
- `notices.sendBatch({ cycle, ids })` (`send_batch`; refuses `window_open`) → `{ sent: number; skipped: number }`.
- `notices.sendTest({ decision })` (`send_rejection` for rejected, `send_batch` otherwise) → `{ ok: true }`.

- [ ] **Step 1: The three bodies**

Append to `convex/emails.ts`:

```ts
/**
 * The three decisions a family hears about. Fixed copy, drafted for XUNTAS
 * to approve: no internal note ever reaches a body, and no name beyond the
 * athlete's own. `cycleTitle` comes from the row so a 2027 email says 2027.
 */
function decisionBody(decision: 'rejected' | 'selected' | 'not_selected', firstName: string, cycleTitle: string) {
  const name = textForEmail(firstName, 60)
  const title = textForEmail(cycleTitle)
  switch (decision) {
    case 'rejected':
      return {
        subject: `Sobre tu registro · ${cycleTitle}`,
        preheader: 'Revisamos tu registro a la Convocatoria.',
        html: `<p style="margin:0 0 14px;">Hola, ${name}:</p>
          <p style="margin:0 0 14px;">Revisamos tu registro a la ${title} del Programa de Desarrollo y, en esta ocasión, no cumple con los requisitos de la convocatoria.</p>
          <p style="margin:0 0 14px;">Sabemos que detrás de un registro hay trabajo y ganas. Te animamos a seguir compitiendo y a registrarte en la siguiente convocatoria.</p>
          <p style="margin:0 0 14px;">Si tienes dudas, responde a este correo.</p>`,
      }
    case 'selected':
      return {
        subject: 'Fuiste seleccionad@ · Programa de Desarrollo XUNTAS+XUNTOS',
        preheader: 'El Consejo Técnico te seleccionó.',
        html: `<p style="margin:0 0 14px;">Hola, ${name}:</p>
          <p style="margin:0 0 14px;"><b>El Consejo Técnico te seleccionó para el Programa de Desarrollo</b> en la ${title}.</p>
          <p style="margin:0 0 14px;">En los próximos días te escribiremos con los siguientes pasos y la documentación que necesitamos para completar tu expediente.</p>
          <p style="margin:0 0 14px;">Felicidades. Nos da mucho gusto que formes parte.</p>
          ${button(`${appUrl()}/es/mi-registro`, 'Ver mi registro')}`,
      }
    case 'not_selected':
      return {
        subject: `Sobre tu registro · ${cycleTitle}`,
        preheader: 'El Consejo Técnico terminó su revisión.',
        html: `<p style="margin:0 0 14px;">Hola, ${name}:</p>
          <p style="margin:0 0 14px;">El Consejo Técnico terminó la revisión de la ${title}. En esta ocasión no fuiste seleccionad@ para el Programa de Desarrollo.</p>
          <p style="margin:0 0 14px;">El registro fue numeroso y los lugares, pocos. Esto no dice nada de tu potencial: te animamos a seguir compitiendo y a registrarte en la siguiente convocatoria.</p>
          <p style="margin:0 0 14px;">Si tienes dudas, responde a este correo.</p>`,
      }
  }
}

const vNoticeDecision = v.union(v.literal('rejected'), v.literal('selected'), v.literal('not_selected'))

export const sendDecisionNotice = internalMutation({
  args: { registrationId: v.id('registrations'), sentBy: v.id('users'), cycleTitle: v.string() },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.registrationId)
    if (!r || !r.decisionNotice || r.decisionNotice.status !== 'not_sent') return
    const user = await ctx.db.get(r.userId)
    if (!user) return

    const firstName = r.personal.name.trim().split(/\s+/)[0] || user.name || 'hola'
    const body = decisionBody(r.decisionNotice.decision, firstName, args.cycleTitle)
    // The ACCOUNT email, which Clerk verified — never the one typed into the form.
    const emailId = await resend.sendEmail(ctx, {
      from: FROM,
      to: user.email,
      replyTo: [REPLY_TO],
      subject: body.subject,
      html: template(body.html, body.preheader),
    })
    await ctx.db.patch(r._id, {
      decisionNotice: { ...r.decisionNotice, status: 'sent', emailId, sentAt: Date.now(), sentBy: args.sentBy },
    })
  },
})

export const sendDecisionTest = internalMutation({
  args: { to: v.string(), decision: vNoticeDecision, cycleTitle: v.string() },
  handler: async (ctx, args) => {
    const body = decisionBody(args.decision, 'Prueba', args.cycleTitle)
    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject: `[PRUEBA] ${body.subject}`,
      html: template(body.html, body.preheader),
    })
  },
})
```

(`resend.sendEmail` returns the email id — confirm against `node_modules/@convex-dev/resend` types; if it returns void, use the `emailId` the component reports in `onEmailEvent` matched by recipient instead, and note the change in the spec.)

- [ ] **Step 2: `recordEmailEvent` moves the notice**

Replace the body of `recordEmailEvent` with:

```ts
  handler: async (ctx, args) => {
    const type = args.event.type
    const failed = type === 'email.bounced' || type === 'email.complained'
    if (failed) {
      console.error(`[email] FAILURE ${type} id=${args.id} — check who it was addressed to in the Resend dashboard`)
    } else if (type === 'email.delivery_delayed') {
      console.warn(`[email] delayed id=${args.id}`)
    }

    // A decision notice: the table shows delivered/bounced so nobody assumes
    // a family knows something the mail never reached them with.
    if (failed || type === 'email.delivered') {
      const r = await ctx.db
        .query('registrations')
        .withIndex('by_notice_email', (q) => q.eq('decisionNotice.emailId', args.id))
        .unique()
      if (r?.decisionNotice) {
        await ctx.db.patch(r._id, {
          decisionNotice: { ...r.decisionNotice, status: failed ? 'bounced' : 'delivered' },
        })
      }
    }
  },
```

- [ ] **Step 3: `convex/notices.ts`**

```ts
import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { internal } from './_generated/api'
import type { AppErrorCode } from './lib/errorCodes'
import { isWindowOpenFor, titleOf } from './lib/cycleRules'
import { requirePermission } from './users'

function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}

const vNoticeDecision = v.union(v.literal('rejected'), v.literal('selected'), v.literal('not_selected'))

async function cycleTitleOf(ctx: Parameters<Parameters<typeof mutation>[0]['handler']>[0], cycle: string) {
  const row = await ctx.db
    .query('cycles')
    .withIndex('by_cycle', (q) => q.eq('cycle', cycle))
    .unique()
  return titleOf(row?.cycle ?? cycle, 'es')
}

/** One rejection, any time. Screening a person out early is a kindness, not a batch. */
export const sendRejection = mutation({
  args: { id: v.id('registrations') },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'send_rejection')
    const r = await ctx.db.get(args.id)
    if (!r) fail('registration_not_found')
    if (r.decisionNotice?.decision !== 'rejected') fail('decision_invalid')
    if (r.decisionNotice.status !== 'not_sent') fail('notice_not_pending')
    await ctx.scheduler.runAfter(0, internal.emails.sendDecisionNotice, {
      registrationId: r._id,
      sentBy: actor._id,
      cycleTitle: await cycleTitleOf(ctx, r.cycle),
    })
    return { ok: true as const }
  },
})

/**
 * The Council's results. Refused while the cycle's window is open — nobody
 * gets "selected" while others are still submitting — and skips anything
 * already sent, so pressing twice sends nothing twice.
 */
export const sendBatch = mutation({
  args: { cycle: v.string(), ids: v.array(v.id('registrations')) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, 'send_batch')
    const cycle = await ctx.db
      .query('cycles')
      .withIndex('by_cycle', (q) => q.eq('cycle', args.cycle))
      .unique()
    if (!cycle) fail('cycle_not_found')
    if (isWindowOpenFor(cycle)) fail('window_open')
    const cycleTitle = titleOf(cycle.cycle, 'es')

    let sent = 0
    let skipped = 0
    for (const id of args.ids) {
      const r = await ctx.db.get(id)
      if (!r || r.cycle !== args.cycle || !r.decisionNotice || r.decisionNotice.status !== 'not_sent') {
        skipped++
        continue
      }
      await ctx.scheduler.runAfter(0, internal.emails.sendDecisionNotice, {
        registrationId: r._id,
        sentBy: actor._id,
        cycleTitle,
      })
      sent++
    }
    if (sent === 0) fail('nothing_to_send')
    return { sent, skipped }
  },
})

/** The body, to the actor's own address. What stops a typo going to two hundred families. */
export const sendTest = mutation({
  args: { cycle: v.string(), decision: vNoticeDecision },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, args.decision === 'rejected' ? 'send_rejection' : 'send_batch')
    await ctx.scheduler.runAfter(0, internal.emails.sendDecisionTest, {
      to: actor.email,
      decision: args.decision,
      cycleTitle: await cycleTitleOf(ctx, args.cycle),
    })
    return { ok: true as const }
  },
})
```

Replace the `Parameters<Parameters<…>>` type on `cycleTitleOf` with `MutationCtx` imported from `./_generated/server`.

- [ ] **Step 4: Check and push**

Run: `npm run check && npx convex dev --once`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add convex/emails.ts convex/notices.ts
git commit -m "feat(review): decision emails, individual and batch sending, delivery status

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: View presets and the client filter

**Files:**
- Create: `src/lib/adminViews.ts`
- Test: `tests/adminViews.test.ts`

**Interfaces:**
- `type AdminRow` (mirror of `listForAdmin`'s row; import the type via `FunctionReturnType<typeof api.registrations.listForAdmin>[number]` in components, and a structural copy here so the module stays pure).
- `type ViewId = 'pending' | 'all' | 'incomplete'`
- `type Filters = { status: RegistrationStatus | 'any'; branch: 'womens' | 'mens' | 'any'; guardian: 'any' | 'pending' | 'ok'; minSections: number; notice: NoticeStatus | 'any' }`
- `const VIEWS: Record<ViewId, { filters: Filters; sort: { id: string; desc: boolean }; selectable: boolean }>`
- `function applyFilters(rows: AdminRow[], f: Filters): AdminRow[]`
- `function batchable(rows: AdminRow[]): AdminRow[]` — rows with `notice === 'not_sent'`.

- [ ] **Step 1: Failing test**

```ts
// tests/adminViews.test.ts
import { describe, expect, it } from 'vitest'
import { VIEWS, applyFilters, batchable, type AdminRow } from '../src/lib/adminViews'

const row = (over: Partial<AdminRow>): AdminRow => ({
  _id: 'r',
  status: 'submitted',
  updatedAt: 0,
  name: 'Ana',
  email: 'a@x.org',
  branch: 'womens',
  state: 'NL',
  isMinor: false,
  guardianRequired: false,
  guardianConfirmed: true,
  sectionsComplete: 7,
  notice: null,
  decision: null,
  ...over,
})

const rows = [
  row({ _id: 'a', status: 'submitted' }),
  row({ _id: 'b', status: 'draft', sectionsComplete: 3 }),
  row({ _id: 'c', status: 'validated', branch: 'mens', guardianRequired: true, guardianConfirmed: false }),
  row({ _id: 'd', status: 'rejected', notice: 'not_sent', decision: 'rejected' }),
]

describe('view presets', () => {
  it('pending shows only submitted', () => {
    expect(applyFilters(rows, VIEWS.pending.filters).map((r) => r._id)).toEqual(['a'])
  })
  it('incomplete shows only drafts, sorted by sections ascending', () => {
    expect(applyFilters(rows, VIEWS.incomplete.filters).map((r) => r._id)).toEqual(['b'])
    expect(VIEWS.incomplete.sort).toEqual({ id: 'sectionsComplete', desc: false })
  })
  it('all shows everything and is the only selectable view', () => {
    expect(applyFilters(rows, VIEWS.all.filters)).toHaveLength(4)
    expect(VIEWS.all.selectable).toBe(true)
    expect(VIEWS.pending.selectable).toBe(false)
  })
})

describe('applyFilters', () => {
  it('filters by branch, guardian and minimum sections', () => {
    expect(applyFilters(rows, { ...VIEWS.all.filters, branch: 'mens' }).map((r) => r._id)).toEqual(['c'])
    expect(applyFilters(rows, { ...VIEWS.all.filters, guardian: 'pending' }).map((r) => r._id)).toEqual(['c'])
    expect(applyFilters(rows, { ...VIEWS.all.filters, minSections: 5 })).toHaveLength(3)
  })
  it('filters by notice state', () => {
    expect(applyFilters(rows, { ...VIEWS.all.filters, notice: 'not_sent' }).map((r) => r._id)).toEqual(['d'])
  })
})

describe('batchable', () => {
  it('keeps only rows with a pending notice', () => {
    expect(batchable(rows).map((r) => r._id)).toEqual(['d'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/adminViews.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

```ts
// src/lib/adminViews.ts
import type { NoticeDecision, NoticeStatus, RegistrationStatus } from '../../convex/lib/decisionRules'

/**
 * The three views are presets over one query, not three queries. Filtering
 * a few hundred rows in the browser is instant and keeps the table reactive
 * to every decision someone else makes.
 */
export type AdminRow = {
  _id: string
  status: RegistrationStatus
  submittedAt?: number
  updatedAt: number
  name: string
  email: string
  branch: 'womens' | 'mens'
  state: string
  isMinor: boolean
  guardianRequired: boolean
  guardianConfirmed: boolean
  sectionsComplete: number
  notice: NoticeStatus | null
  decision: NoticeDecision | null
}

export type ViewId = 'pending' | 'all' | 'incomplete'

export type Filters = {
  status: RegistrationStatus | 'any'
  branch: 'womens' | 'mens' | 'any'
  guardian: 'any' | 'pending' | 'ok'
  minSections: number
  notice: NoticeStatus | 'any'
}

const ANY: Filters = { status: 'any', branch: 'any', guardian: 'any', minSections: 0, notice: 'any' }

export const VIEWS: Record<ViewId, { filters: Filters; sort: { id: string; desc: boolean }; selectable: boolean }> = {
  pending: { filters: { ...ANY, status: 'submitted' }, sort: { id: 'submittedAt', desc: false }, selectable: false },
  all: { filters: ANY, sort: { id: 'name', desc: false }, selectable: true },
  incomplete: { filters: { ...ANY, status: 'draft' }, sort: { id: 'sectionsComplete', desc: false }, selectable: false },
}

export function applyFilters(rows: AdminRow[], f: Filters): AdminRow[] {
  return rows.filter(
    (r) =>
      (f.status === 'any' || r.status === f.status) &&
      (f.branch === 'any' || r.branch === f.branch) &&
      (f.guardian === 'any' ||
        (f.guardian === 'pending' ? r.guardianRequired && !r.guardianConfirmed : r.guardianConfirmed)) &&
      r.sectionsComplete >= f.minSections &&
      (f.notice === 'any' || r.notice === f.notice),
  )
}

/** What a batch may send: rows whose notice is waiting. */
export function batchable(rows: AdminRow[]): AdminRow[] {
  return rows.filter((r) => r.notice === 'not_sent')
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/adminViews.test.ts`
Expected: PASS (6 tests).

```bash
git add src/lib/adminViews.ts tests/adminViews.test.ts
git commit -m "feat(review): view presets and client-side filters for the registrations table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The registrations table page

**Files:**
- Create: `src/components/Admin/StatusChip.tsx`, `RegistrationFilters.tsx`, `RegistrationsTable.tsx`, `BatchSendDialog.tsx`
- Create: `src/routes/administracion.registros.tsx`
- Modify: `src/components/Admin/AdminShell.tsx` (restore `registros` in `NAV`), `src/routes/administracion.index.tsx`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/components/RegistrationsTable.test.tsx`

**Interfaces:**
- `StatusChip({ status })`, `NoticeChip({ notice })`, `GuardianChip({ required, confirmed })` — chips with a word.
- `RegistrationsTable({ rows, view, canSelect, selected, onSelectedChange, onOpen })`.
- `BatchSendDialog({ count, cycle, onConfirm, onTest, onClose })`.

- [ ] **Step 1: Messages**

`es.json`:

```json
  "regs_title": "Registros",
  "regs_view_pending": "Pendientes",
  "regs_view_all": "Todos",
  "regs_view_incomplete": "Incompletos",
  "regs_col_name": "Nombre",
  "regs_col_branch": "Rama",
  "regs_col_status": "Estado",
  "regs_col_sections": "Secciones",
  "regs_col_guardian": "Tutor",
  "regs_col_notice": "Correo",
  "regs_col_submitted": "Enviado",
  "regs_sections": "{n}/{total}",
  "regs_none": "Nada que mostrar con estos filtros.",
  "regs_count": "{n} registros",
  "regs_filter_status": "Estado",
  "regs_filter_branch": "Rama",
  "regs_filter_guardian": "Tutor",
  "regs_filter_sections": "Secciones ≥",
  "regs_filter_notice": "Correo",
  "regs_filter_any": "cualquiera",
  "regs_guardian_pending": "falta tutor",
  "regs_guardian_ok": "tutor ok",
  "regs_guardian_na": "mayor de edad",
  "regs_select_all": "Seleccionar todo",
  "regs_selected": "{n} seleccionados",
  "regs_send_batch": "Enviar correos",
  "regs_open": "Abrir",
  "status_validated": "Validado",
  "status_rejected": "Rechazado",
  "status_selected": "Seleccionado",
  "status_not_selected": "No seleccionado",
  "notice_none": "—",
  "notice_not_sent": "pendiente",
  "notice_sent": "enviado",
  "notice_delivered": "entregado",
  "notice_bounced": "rebotó",
  "batch_title": "Enviar {n} correos",
  "batch_text": "Se enviará el correo de decisión a {n} personas con correo pendiente. No se puede deshacer.",
  "batch_window_open": "El periodo de registro sigue abierto: no se pueden enviar resultados todavía.",
  "batch_test": "Enviarme una prueba",
  "batch_test_sent": "Prueba enviada a tu correo.",
  "batch_confirm": "Enviar",
  "batch_done": "{sent} enviados, {skipped} omitidos.",
```

`en.json`:

```json
  "regs_title": "Registrations",
  "regs_view_pending": "Pending",
  "regs_view_all": "All",
  "regs_view_incomplete": "Incomplete",
  "regs_col_name": "Name",
  "regs_col_branch": "Branch",
  "regs_col_status": "Status",
  "regs_col_sections": "Sections",
  "regs_col_guardian": "Guardian",
  "regs_col_notice": "Email",
  "regs_col_submitted": "Submitted",
  "regs_sections": "{n}/{total}",
  "regs_none": "Nothing to show with these filters.",
  "regs_count": "{n} registrations",
  "regs_filter_status": "Status",
  "regs_filter_branch": "Branch",
  "regs_filter_guardian": "Guardian",
  "regs_filter_sections": "Sections ≥",
  "regs_filter_notice": "Email",
  "regs_filter_any": "any",
  "regs_guardian_pending": "guardian missing",
  "regs_guardian_ok": "guardian ok",
  "regs_guardian_na": "of age",
  "regs_select_all": "Select all",
  "regs_selected": "{n} selected",
  "regs_send_batch": "Send emails",
  "regs_open": "Open",
  "status_validated": "Validated",
  "status_rejected": "Rejected",
  "status_selected": "Selected",
  "status_not_selected": "Not selected",
  "notice_none": "—",
  "notice_not_sent": "pending",
  "notice_sent": "sent",
  "notice_delivered": "delivered",
  "notice_bounced": "bounced",
  "batch_title": "Send {n} emails",
  "batch_text": "The decision email will go to {n} people with a pending email. This can't be undone.",
  "batch_window_open": "The registration period is still open: results can't be sent yet.",
  "batch_test": "Send me a test",
  "batch_test_sent": "Test sent to your email.",
  "batch_confirm": "Send",
  "batch_done": "{sent} sent, {skipped} skipped.",
```

- [ ] **Step 2: `StatusChip.tsx`**

```tsx
// src/components/Admin/StatusChip.tsx
import * as m from '../../paraglide/messages.js'
import type { NoticeStatus, RegistrationStatus } from '../../../convex/lib/decisionRules'

const STATUS: Record<RegistrationStatus, { label: () => string; cls: string }> = {
  draft: { label: m.status_draft, cls: 'chip' },
  submitted: { label: m.status_submitted, cls: 'chip chip-warn' },
  validated: { label: m.status_validated, cls: 'chip chip-ok' },
  rejected: { label: m.status_rejected, cls: 'chip chip-bad' },
  selected: { label: m.status_selected, cls: 'chip chip-y' },
  not_selected: { label: m.status_not_selected, cls: 'chip' },
}

export function StatusChip({ status }: { status: RegistrationStatus }) {
  const s = STATUS[status]
  return <span className={s.cls}>{s.label()}</span>
}

const NOTICE: Record<NoticeStatus, { label: () => string; cls: string }> = {
  not_sent: { label: m.notice_not_sent, cls: 'chip chip-warn' },
  sent: { label: m.notice_sent, cls: 'chip' },
  delivered: { label: m.notice_delivered, cls: 'chip chip-ok' },
  bounced: { label: m.notice_bounced, cls: 'chip chip-bad' },
}

export function NoticeChip({ notice }: { notice: NoticeStatus | null }) {
  if (!notice) return <span className="text-soft">{m.notice_none()}</span>
  const n = NOTICE[notice]
  return <span className={n.cls}>{n.label()}</span>
}

export function GuardianChip({ required, confirmed }: { required: boolean; confirmed: boolean }) {
  if (!required) return <span className="chip">{m.regs_guardian_na()}</span>
  return confirmed ? (
    <span className="chip chip-ok">{m.regs_guardian_ok()}</span>
  ) : (
    <span className="chip chip-bad">{m.regs_guardian_pending()}</span>
  )
}
```

- [ ] **Step 3: `RegistrationFilters.tsx`**

```tsx
// src/components/Admin/RegistrationFilters.tsx
import * as m from '../../paraglide/messages.js'
import type { Filters } from '../../lib/adminViews'
import { SECTIONS_TOTAL } from '../../../convex/lib/decisionRules'

type Props = { value: Filters; onChange: (next: Filters) => void; lockStatus?: boolean }

function Select<T extends string>({ id, label, value, options, onChange }: {
  id: string
  label: string
  value: T
  options: Array<{ v: T; t: string }>
  onChange: (v: T) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
      {label}
      <select id={id} className="fld-input w-auto py-1.5 font-mono text-[11.5px] normal-case tracking-normal" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.t}</option>
        ))}
      </select>
    </label>
  )
}

export default function RegistrationFilters({ value, onChange, lockStatus }: Props) {
  const any = m.regs_filter_any()
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      {!lockStatus && (
        <Select
          id="f-status"
          label={m.regs_filter_status()}
          value={value.status}
          onChange={(status) => onChange({ ...value, status })}
          options={[
            { v: 'any', t: any },
            { v: 'draft', t: m.status_draft() },
            { v: 'submitted', t: m.status_submitted() },
            { v: 'validated', t: m.status_validated() },
            { v: 'rejected', t: m.status_rejected() },
            { v: 'selected', t: m.status_selected() },
            { v: 'not_selected', t: m.status_not_selected() },
          ]}
        />
      )}
      <Select
        id="f-branch"
        label={m.regs_filter_branch()}
        value={value.branch}
        onChange={(branch) => onChange({ ...value, branch })}
        options={[{ v: 'any', t: any }, { v: 'womens', t: m.reg_branch_womens() }, { v: 'mens', t: m.reg_branch_mens() }]}
      />
      <Select
        id="f-guardian"
        label={m.regs_filter_guardian()}
        value={value.guardian}
        onChange={(guardian) => onChange({ ...value, guardian })}
        options={[{ v: 'any', t: any }, { v: 'pending', t: m.regs_guardian_pending() }, { v: 'ok', t: m.regs_guardian_ok() }]}
      />
      <Select
        id="f-sections"
        label={m.regs_filter_sections()}
        value={String(value.minSections)}
        onChange={(n) => onChange({ ...value, minSections: Number(n) })}
        options={Array.from({ length: SECTIONS_TOTAL + 1 }, (_, i) => ({ v: String(i), t: String(i) }))}
      />
      <Select
        id="f-notice"
        label={m.regs_filter_notice()}
        value={value.notice}
        onChange={(notice) => onChange({ ...value, notice })}
        options={[
          { v: 'any', t: any },
          { v: 'not_sent', t: m.notice_not_sent() },
          { v: 'sent', t: m.notice_sent() },
          { v: 'delivered', t: m.notice_delivered() },
          { v: 'bounced', t: m.notice_bounced() },
        ]}
      />
    </div>
  )
}
```

- [ ] **Step 4: Failing table test**

```tsx
// tests/components/RegistrationsTable.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RegistrationsTable from '../../src/components/Admin/RegistrationsTable'
import type { AdminRow } from '../../src/lib/adminViews'

const rows: AdminRow[] = [
  { _id: 'a', status: 'submitted', submittedAt: 1, updatedAt: 1, name: 'Ana', email: 'a@x', branch: 'womens', state: 'NL', isMinor: true, guardianRequired: true, guardianConfirmed: false, sectionsComplete: 7, notice: null, decision: null },
  { _id: 'b', status: 'rejected', submittedAt: 2, updatedAt: 2, name: 'Bea', email: 'b@x', branch: 'mens', state: 'JAL', isMinor: false, guardianRequired: false, guardianConfirmed: true, sectionsComplete: 5, notice: 'not_sent', decision: 'rejected' },
]

describe('RegistrationsTable', () => {
  it('shows a word for every state, never only a colour', () => {
    render(<RegistrationsTable rows={rows} view="all" canSelect={false} selected={new Set()} onSelectedChange={() => {}} onOpen={() => {}} />)
    expect(screen.getByText(m.status_submitted())).toBeInTheDocument()
    expect(screen.getByText(m.regs_guardian_pending())).toBeInTheDocument()
    expect(screen.getByText(m.notice_not_sent())).toBeInTheDocument()
    expect(screen.getByText(m.regs_sections({ n: 5, total: 7 }))).toBeInTheDocument()
  })

  it('opens a row', () => {
    const onOpen = vi.fn()
    render(<RegistrationsTable rows={rows} view="all" canSelect={false} selected={new Set()} onSelectedChange={() => {}} onOpen={onOpen} />)
    fireEvent.click(screen.getAllByRole('button', { name: m.regs_open() })[0])
    expect(onOpen).toHaveBeenCalledWith('a')
  })

  it('selects only batchable rows when allowed', () => {
    const onSelectedChange = vi.fn()
    render(<RegistrationsTable rows={rows} view="all" canSelect selected={new Set()} onSelectedChange={onSelectedChange} onOpen={() => {}} />)
    const boxes = screen.getAllByRole('checkbox')
    // header + one enabled row (Bea); Ana has no pending notice.
    expect(boxes.filter((b) => !(b as HTMLInputElement).disabled)).toHaveLength(2)
    fireEvent.click(screen.getByRole('checkbox', { name: m.regs_select_all() }))
    expect(onSelectedChange).toHaveBeenCalledWith(new Set(['b']))
  })
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run tests/components/RegistrationsTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 6: `RegistrationsTable.tsx`**

```tsx
// src/components/Admin/RegistrationsTable.tsx
import { useMemo } from 'react'
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import * as m from '../../paraglide/messages.js'
import { SECTIONS_TOTAL } from '../../../convex/lib/decisionRules'
import { VIEWS, batchable, type AdminRow, type ViewId } from '../../lib/adminViews'
import { useDateFormats } from '../DateField/format'
import { GuardianChip, NoticeChip, StatusChip } from './StatusChip'

type Props = {
  rows: AdminRow[]
  view: ViewId
  canSelect: boolean
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  onOpen: (id: string) => void
}

/**
 * Sorting is the table's; filtering happened before the rows arrived, and
 * selection is ours — the checkbox column only exists in the one view where
 * a batch can be sent, and only rows with a pending notice may be ticked.
 */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text, alphanumeric: sortFn_alphanumeric },
})

const helper = createColumnHelper<typeof features, AdminRow>()

export default function RegistrationsTable({ rows, view, canSelect, selected, onSelectedChange, onOpen }: Props) {
  const fmt = useDateFormats()
  const selectable = canSelect && VIEWS[view].selectable
  const eligible = useMemo(() => new Set(batchable(rows).map((r) => r._id)), [rows])

  const columns = useMemo(() => {
    const cols = [
      helper.accessor('name', { header: m.regs_col_name, sortFn: 'text' }),
      helper.accessor('branch', {
        header: m.regs_col_branch,
        cell: (c) => (c.getValue() === 'womens' ? m.reg_branch_womens() : m.reg_branch_mens()),
      }),
      helper.accessor('status', { header: m.regs_col_status, cell: (c) => <StatusChip status={c.getValue()} /> }),
      helper.accessor('sectionsComplete', {
        header: m.regs_col_sections,
        sortFn: 'alphanumeric',
        cell: (c) => <span className="font-mono text-[12px]">{m.regs_sections({ n: c.getValue(), total: SECTIONS_TOTAL })}</span>,
      }),
      helper.display({
        id: 'guardian',
        header: m.regs_col_guardian,
        cell: (c) => <GuardianChip required={c.row.original.guardianRequired} confirmed={c.row.original.guardianConfirmed} />,
      }),
      helper.accessor('notice', { header: m.regs_col_notice, cell: (c) => <NoticeChip notice={c.getValue()} /> }),
      helper.accessor((r) => r.submittedAt ?? 0, {
        id: 'submittedAt',
        header: m.regs_col_submitted,
        sortFn: 'alphanumeric',
        cell: (c) => (c.getValue() ? fmt.full.format(new Date(c.getValue())) : '—'),
      }),
      helper.display({
        id: 'open',
        header: '',
        cell: (c) => (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(c.row.original._id)}>
            {m.regs_open()}
          </button>
        ),
      }),
    ]
    if (selectable) {
      cols.unshift(
        helper.display({
          id: 'select',
          header: () => (
            <input
              type="checkbox"
              aria-label={m.regs_select_all()}
              checked={eligible.size > 0 && [...eligible].every((id) => selected.has(id))}
              disabled={eligible.size === 0}
              onChange={(e) => onSelectedChange(e.target.checked ? new Set(eligible) : new Set())}
            />
          ),
          cell: (c) => {
            const id = c.row.original._id
            const ok = eligible.has(id)
            return (
              <input
                type="checkbox"
                aria-label={c.row.original.name}
                checked={selected.has(id)}
                disabled={!ok}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(id)
                  else next.delete(id)
                  onSelectedChange(next)
                }}
              />
            )
          },
        }),
      )
    }
    return helper.columns(cols)
  }, [eligible, fmt.full, onOpen, onSelectedChange, selectable, selected])

  const table = useTable(
    { features, columns, data: rows, initialState: { sorting: [VIEWS[view].sort] } },
    (s) => s,
  )
  const body = table.getRowModel().rows

  return (
    <div className="card mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-line">
              {hg.headers.map((h) => (
                <th key={h.id} className="px-3 py-2 text-left font-mono text-[10.5px] font-medium tracking-[.12em] uppercase text-soft">
                  {h.isPlaceholder ? null : h.column.getCanSort() ? (
                    <button type="button" onClick={h.column.getToggleSortingHandler()}>
                      <table.FlexRender header={h} />
                      {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
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
          {body.length === 0 && (
            <tr>
              <td className="px-3 py-3 font-light text-soft" colSpan={99}>{m.regs_none()}</td>
            </tr>
          )}
          {body.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-middle">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">{m.regs_count({ n: body.length })}</p>
    </div>
  )
}
```

(As in Plan 1: confirm the v9 export names against `node_modules/@tanstack/react-table/dist/esm/index.d.ts`. `initialState.sorting` is the v9 option per the migration guide's sorting example.)

- [ ] **Step 7: Run the test**

Run: `npx vitest run tests/components/RegistrationsTable.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 8: `BatchSendDialog.tsx`**

```tsx
// src/components/Admin/BatchSendDialog.tsx
import { useEffect, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'

type Props = {
  count: number
  windowOpen: boolean
  onConfirm: () => Promise<{ sent: number; skipped: number }>
  onTest: () => Promise<void>
  onClose: () => void
}

/**
 * The one dialog in the app, native `<dialog>` so focus and Escape are the
 * browser's. It says the count, refuses while the window is open, and offers
 * a test send — ten lines that stop a typo going to two hundred families.
 */
export default function BatchSendDialog({ count, windowOpen, onConfirm, onTest, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  /* Why an effect: showModal is an imperative browser call that must run after mount. */
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog ref={ref} onClose={onClose} className="card m-auto max-w-[52ch] px-[21px] py-[19px] backdrop:bg-ink/40">
      <b className="block font-disp text-[16px]">{m.batch_title({ n: count })}</b>
      <p className="mt-2 text-[13px] font-light text-soft">
        {windowOpen ? m.batch_window_open() : m.batch_text({ n: count })}
      </p>
      {note && <p className="mt-2 text-[12.5px] text-soft">{note}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn"
          disabled={busy || windowOpen || count === 0}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await onConfirm()
              setNote(m.batch_done({ sent: r.sent, skipped: r.skipped }))
            } finally {
              setBusy(false)
            }
          }}
        >
          {m.batch_confirm()}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            await onTest()
            setNote(m.batch_test_sent())
          }}
        >
          {m.batch_test()}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
          {m.common_back()}
        </button>
      </div>
    </dialog>
  )
}
```

- [ ] **Step 9: The route**

```tsx
// src/routes/administracion.registros.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import BatchSendDialog from '../components/Admin/BatchSendDialog'
import NoTools from '../components/Admin/NoTools'
import RegistrationFilters from '../components/Admin/RegistrationFilters'
import RegistrationsTable from '../components/Admin/RegistrationsTable'
import { useActiveCycle } from '../hooks/useActiveCycle'
import { useAdminCycle } from '../hooks/useAdminCycle'
import { useMe } from '../hooks/useMe'
import { VIEWS, applyFilters, type Filters, type ViewId } from '../lib/adminViews'
import { can } from '../lib/permissions'
import { describeConvexError } from '../lib/registrationErrors'

export const Route = createFileRoute('/administracion/registros')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.regs_title() }) }] }),
  validateSearch: (s: Record<string, unknown>): { vista?: ViewId } =>
    s.vista === 'pending' || s.vista === 'all' || s.vista === 'incomplete' ? { vista: s.vista } : {},
  component: RegistrationsPage,
})

const VIEW_LABEL: Record<ViewId, () => string> = {
  pending: m.regs_view_pending,
  all: m.regs_view_all,
  incomplete: m.regs_view_incomplete,
}

function RegistrationsPage() {
  const me = useMe()
  const { cycle } = useAdminCycle()
  const active = useActiveCycle()
  const { vista } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const view: ViewId = vista ?? 'pending'

  const rows = useQuery(api.registrations.listForAdmin, cycle && me && can(me.roles, 'review_registrations') ? { cycle } : 'skip')
  const sendBatch = useMutation(api.notices.sendBatch)
  const sendTest = useMutation(api.notices.sendTest)

  const [filters, setFilters] = useState<Filters>(VIEWS[view].filters)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shown = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters])

  if (!me) return null
  if (!can(me.roles, 'review_registrations')) return <NoTools />
  if (rows === undefined || !cycle) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  const canBatch = can(me.roles, 'send_batch')
  const windowOpen = active?.cycle === cycle ? (active?.isOpen ?? true) : false

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2" role="tablist">
        {(Object.keys(VIEWS) as ViewId[]).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === view}
            className={`rounded-ctl border px-3 py-1.5 font-mono text-[11.5px] tracking-[.08em] uppercase ${v === view ? 'border-line-2 text-ink' : 'border-transparent text-soft hover:text-ink'}`}
            onClick={() => {
              setFilters(VIEWS[v].filters)
              setSelected(new Set())
              void navigate({ search: { vista: v }, replace: true })
            }}
          >
            {VIEW_LABEL[v]()}
          </button>
        ))}
        {canBatch && view === 'all' && (
          <button type="button" className="btn btn-sm ml-auto" disabled={selected.size === 0} onClick={() => setDialog(true)}>
            {m.regs_send_batch()} · {m.regs_selected({ n: selected.size })}
          </button>
        )}
      </div>

      <RegistrationFilters value={filters} onChange={setFilters} lockStatus={view !== 'all'} />
      {error && <p className="mt-3 text-[12.5px] text-bad">{error}</p>}

      <RegistrationsTable
        rows={shown}
        view={view}
        canSelect={canBatch}
        selected={selected}
        onSelectedChange={setSelected}
        onOpen={(id) => void navigate({ to: '/administracion/registros/$id', params: { id } })}
      />

      {dialog && (
        <BatchSendDialog
          count={selected.size}
          windowOpen={windowOpen}
          onConfirm={async () => {
            try {
              const r = await sendBatch({ cycle, ids: [...selected] as never })
              setSelected(new Set())
              return r
            } catch (err) {
              setError(describeConvexError(err))
              return { sent: 0, skipped: selected.size }
            }
          }}
          onTest={async () => {
            await sendTest({ cycle, decision: 'selected' })
          }}
          onClose={() => setDialog(false)}
        />
      )}
    </>
  )
}
```

Replace `as never` by typing `selected` as `Set<Id<'registrations'>>` and `AdminRow._id` as `Id<'registrations'>` (the test fixtures cast with `as Id<'registrations'>`).

- [ ] **Step 10: Shell and index**

In `AdminShell.tsx` restore `{ to: '/administracion/registros', label: m.admin_nav_registrations, needs: 'review_registrations' }` as the first `NAV` entry. In `administracion.index.tsx`, before the `view_staff` branch:

```tsx
  if (can(me.roles, 'review_registrations')) return <Navigate to="/administracion/registros" replace />
```

- [ ] **Step 11: Generate, check, verify**

Run: `npm run generate-routes && npm run check`
Expected: green.

In the browser as master_admin with a few dev registrations (submit one as an athlete account, leave one as a draft): *Pendientes* lists the submitted one; *Incompletos* the draft with `n/7`; *Todos* shows checkboxes only on rows with a pending notice (none yet). Sorting by name toggles the arrow.

- [ ] **Step 12: Commit**

```bash
git add src/routes/administracion.registros.tsx src/routes/administracion.index.tsx src/components/Admin src/routeTree.gen.ts messages tests/components/RegistrationsTable.test.tsx
git commit -m "feat(admin): registrations table with three views, filters, and batch dialog

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The detail page and decision panel

**Files:**
- Create: `src/components/Admin/ReadSection.tsx`, `RegistrationDetail.tsx`, `DecisionPanel.tsx`
- Create: `src/routes/administracion.registros.$id.tsx`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/components/DecisionPanel.test.tsx`

**Interfaces:**
- `DecisionPanel({ status, guardianConfirmed, notice, permissions, log, onDecide(decision, note), onSendRejection })` — pure of data fetching.
- `RegistrationDetail({ detail })` renders the eight sections read-only.

- [ ] **Step 1: Messages**

`es.json`:

```json
  "detail_back": "Volver a la lista",
  "detail_account": "Cuenta",
  "detail_account_email": "Correo de la cuenta",
  "detail_birth": "Fecha de nacimiento",
  "detail_minor": "Menor de edad al abrir la convocatoria",
  "detail_adult": "Mayor de edad",
  "detail_guardian": "Tutor",
  "detail_guardian_sent": "Correo enviado {n} veces",
  "detail_decision": "Decisión",
  "detail_note": "Nota (interna)",
  "detail_note_help": "Obligatoria al rechazar y al cambiar una decisión. Nunca se envía a la persona.",
  "detail_validate": "Validar",
  "detail_reject": "Rechazar",
  "detail_select": "Seleccionar",
  "detail_not_select": "No seleccionar",
  "detail_send_rejection": "Enviar correo de rechazo",
  "detail_log": "Historial",
  "detail_log_none": "Sin decisiones todavía.",
  "detail_log_entry": "{status} · {name} · {when}",
  "detail_yes": "Sí",
  "detail_no": "No",
  "detail_empty": "—",
```

`en.json`:

```json
  "detail_back": "Back to the list",
  "detail_account": "Account",
  "detail_account_email": "Account email",
  "detail_birth": "Date of birth",
  "detail_minor": "Minor when the call opened",
  "detail_adult": "Of age",
  "detail_guardian": "Guardian",
  "detail_guardian_sent": "Email sent {n} times",
  "detail_decision": "Decision",
  "detail_note": "Note (internal)",
  "detail_note_help": "Required when rejecting and when changing a decision. Never sent to the person.",
  "detail_validate": "Validate",
  "detail_reject": "Reject",
  "detail_select": "Select",
  "detail_not_select": "Don't select",
  "detail_send_rejection": "Send rejection email",
  "detail_log": "History",
  "detail_log_none": "No decisions yet.",
  "detail_log_entry": "{status} · {name} · {when}",
  "detail_yes": "Yes",
  "detail_no": "No",
  "detail_empty": "—",
```

- [ ] **Step 2: Failing panel test**

```tsx
// tests/components/DecisionPanel.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import DecisionPanel from '../../src/components/Admin/DecisionPanel'

const REVIEWER = ['review_registrations', 'send_rejection', 'view_staff'] as const
const MASTER = [...REVIEWER, 'select_registrations', 'send_batch', 'manage_users', 'manage_cycles'] as const

function renderPanel(over: Partial<Parameters<typeof DecisionPanel>[0]> = {}) {
  const onDecide = vi.fn(async () => {})
  const onSendRejection = vi.fn(async () => {})
  render(
    <DecisionPanel
      status="submitted"
      guardianConfirmed
      notice={null}
      permissions={[...REVIEWER]}
      log={[]}
      onDecide={onDecide}
      onSendRejection={onSendRejection}
      {...over}
    />,
  )
  return { onDecide, onSendRejection }
}

describe('DecisionPanel', () => {
  it('offers validate and reject to a reviewer on a submitted registration, not select', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: m.detail_validate() })).toBeEnabled()
    expect(screen.getByRole('button', { name: m.detail_reject() })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.detail_select() })).not.toBeInTheDocument()
  })

  it('refuses to reject without a note, from the same rules the server runs', () => {
    const { onDecide } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: m.detail_reject() }))
    expect(onDecide).not.toHaveBeenCalled()
    expect(screen.getByText(m.err_note_required())).toBeInTheDocument()
  })

  it('offers select to a master admin on a validated registration', () => {
    const { onDecide } = renderPanel({ status: 'validated', permissions: [...MASTER] })
    fireEvent.click(screen.getByRole('button', { name: m.detail_select() }))
    expect(onDecide).toHaveBeenCalledWith('selected', '')
  })

  it('offers the rejection email only while the notice is pending', () => {
    const { onSendRejection } = renderPanel({ status: 'rejected', notice: 'not_sent' })
    fireEvent.click(screen.getByRole('button', { name: m.detail_send_rejection() }))
    expect(onSendRejection).toHaveBeenCalled()
    renderPanel({ status: 'rejected', notice: 'sent' })
    expect(screen.getAllByRole('button', { name: m.detail_send_rejection() })).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/components/DecisionPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: `DecisionPanel.tsx`**

```tsx
// src/components/Admin/DecisionPanel.tsx
import { useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { checkDecision, type Decision, type NoticeStatus, type RegistrationStatus } from '../../../convex/lib/decisionRules'
import type { Permission } from '../../lib/permissions'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'
import { useDateFormats } from '../DateField/format'
import { NoticeChip, StatusChip } from './StatusChip'

type LogEntry = { status: Decision; at: number; byName: string; note?: string }

type Props = {
  status: RegistrationStatus
  guardianConfirmed: boolean
  notice: NoticeStatus | null
  permissions: readonly Permission[]
  log: LogEntry[]
  onDecide: (decision: Decision, note: string) => Promise<void>
  onSendRejection: () => Promise<void>
}

const BUTTONS: Array<{ decision: Decision; label: () => string; cls: string }> = [
  { decision: 'validated', label: m.detail_validate, cls: 'btn' },
  { decision: 'rejected', label: m.detail_reject, cls: 'btn btn-ghost hover:border-bad hover:text-bad' },
  { decision: 'selected', label: m.detail_select, cls: 'btn' },
  { decision: 'not_selected', label: m.detail_not_select, cls: 'btn btn-ghost' },
]

/**
 * The buttons are the rules made visible: a button is drawn only if the same
 * `checkDecision` the server runs would let this account press it (ignoring
 * the note, which is asked for on press). Nothing here is the gate.
 */
export default function DecisionPanel({ status, guardianConfirmed, notice, permissions, log, onDecide, onSendRejection }: Props) {
  const fmt = useDateFormats()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const allowed = BUTTONS.filter((b) => {
    const problem = checkDecision({ from: status, to: b.decision, note: 'x', guardianConfirmed, noticeStatus: notice, permissions })
    return problem === null
  })

  async function decide(decision: Decision) {
    const problem = checkDecision({ from: status, to: decision, note, guardianConfirmed, noticeStatus: notice, permissions })
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onDecide(decision, note.trim())
      setNote('')
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="card px-[21px] py-[19px] lg:sticky lg:top-6">
      <p className="eyebrow">{m.detail_decision()}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusChip status={status} />
        <NoticeChip notice={notice} />
      </div>

      {allowed.length > 0 && (
        <>
          <label htmlFor="decision-note" className="mt-5 block text-[12.5px] font-medium">{m.detail_note()}</label>
          <textarea
            id="decision-note"
            className="fld-input mt-1.5 min-h-[80px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="mt-1 text-[11.5px] text-soft">{m.detail_note_help()}</p>
          <p className="min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
          <div className="flex flex-wrap gap-2">
            {allowed.map((b) => (
              <button key={b.decision} type="button" className={b.cls} disabled={busy} onClick={() => void decide(b.decision)}>
                {b.label()}
              </button>
            ))}
          </div>
        </>
      )}

      {status === 'rejected' && notice === 'not_sent' && permissions.includes('send_rejection') && (
        <button
          type="button"
          className="btn btn-ghost mt-4"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSendRejection()
            } catch (err) {
              setError(describeConvexError(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          {m.detail_send_rejection()}
        </button>
      )}

      <p className="eyebrow mt-6">{m.detail_log()}</p>
      {log.length === 0 && <p className="mt-1 text-[12.5px] text-soft">{m.detail_log_none()}</p>}
      <ul className="mt-1 grid gap-2">
        {[...log].reverse().map((e, i) => (
          <li key={i} className="text-[12.5px]">
            <span className="font-mono text-[11px] text-soft">
              {m.detail_log_entry({ status: e.status, name: e.byName, when: fmt.full.format(new Date(e.at)) })}
            </span>
            {e.note && <p className="mt-0.5 font-light">{e.note}</p>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
```

- [ ] **Step 5: Run the panel test**

Run: `npx vitest run tests/components/DecisionPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: `ReadSection.tsx` and `RegistrationDetail.tsx`**

```tsx
// src/components/Admin/ReadSection.tsx
import * as m from '../../paraglide/messages.js'

/** One numbered section, read-only: the same heading pattern as the form's `FormSection`. */
export default function ReadSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-[30px]">
      <h2 className="mb-[9px] font-disp text-[17px] font-bold">
        {n} · {title}
      </h2>
      {children}
    </section>
  )
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="m-0 mt-0.5 text-[14px]">{value || m.detail_empty()}</dd>
    </div>
  )
}

export function Rows({ head, rows }: { head: [string, string]; rows: Array<[string, string]> }) {
  if (rows.length === 0) return <p className="text-[13px] text-soft">{m.detail_empty()}</p>
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead>
        <tr className="border-b border-line">
          <th className="py-1 text-left font-mono text-[10.5px] font-medium tracking-[.12em] uppercase text-soft">{head[0]}</th>
          <th className="py-1 text-left font-mono text-[10.5px] font-medium tracking-[.12em] uppercase text-soft">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i} className="border-b border-line last:border-0">
            <td className="py-1.5 pr-3">{a}</td>
            <td className="py-1.5 font-mono text-[12.5px]">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

```tsx
// src/components/Admin/RegistrationDetail.tsx
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import { SECTIONS_TOTAL } from '../../../convex/lib/decisionRules'
import ReadSection, { Field, Rows } from './ReadSection'
import { GuardianChip } from './StatusChip'

export type Detail = FunctionReturnType<typeof api.registrations.detail>

/**
 * Every section stacked on one page. Someone reading two hundred of these
 * should never click "next", and the letter is the thing being judged, so it
 * is printed whole.
 */
export default function RegistrationDetail({ detail }: { detail: Detail }) {
  const r = detail.registration
  const yes = m.detail_yes()
  const no = m.detail_no()
  return (
    <article>
      <section className="card mb-[30px] px-[21px] py-[15px]">
        <p className="eyebrow">{m.detail_account()}</p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-3">
          <Field label={m.detail_account_email()} value={detail.account.email} />
          <Field label={m.detail_birth()} value={detail.account.birthDate} />
          <Field
            label={m.detail_guardian()}
            value={
              <span className="flex flex-wrap items-center gap-2">
                <GuardianChip required={detail.guardian.required} confirmed={detail.guardian.confirmed} />
                {detail.guardian.required && (
                  <span className="text-[12px] text-soft">
                    {detail.guardian.guardianName} · {detail.guardian.guardianEmail} · {m.detail_guardian_sent({ n: detail.guardian.timesSent ?? 0 })}
                  </span>
                )}
              </span>
            }
          />
        </dl>
        <p className="mt-3 font-mono text-[11px] text-soft">
          {m.regs_col_sections()}: {m.regs_sections({ n: detail.sectionsComplete, total: SECTIONS_TOTAL })}
          {' · '}
          {(r.wasMinorAtCycleStart ?? detail.account.wasMinorAtSignup) ? m.detail_minor() : m.detail_adult()}
        </p>
      </section>

      <ReadSection n={1} title={m.reg_s1_title()}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={m.reg_name()} value={r.personal.name} />
          <Field label={m.reg_email()} value={r.personal.email} />
          <Field label={m.reg_whatsapp()} value={r.personal.whatsapp} />
          <Field label={m.reg_birth_date()} value={r.personal.birthDate} />
          <Field label={m.reg_branch()} value={r.personal.branch === 'womens' ? m.reg_branch_womens() : r.personal.branch === 'mens' ? m.reg_branch_mens() : ''} />
          <Field label={m.reg_state()} value={r.personal.state} />
          <Field label={m.reg_city()} value={r.personal.city} />
        </dl>
      </ReadSection>

      <ReadSection n={2} title={m.reg_s2_title()}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={m.reg_school()} value={r.academic.school} />
          <Field label={m.reg_grade()} value={r.academic.grade} />
          <Field label={m.reg_graduation()} value={r.academic.graduationYear} />
          <Field label={m.reg_interest()} value={r.academic.interest} />
        </dl>
      </ReadSection>

      <ReadSection n={3} title={m.reg_s3_title()}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={m.reg_club()} value={r.athletic.club} />
          <Field label={m.reg_coach()} value={r.athletic.coach} />
          <Field label={m.reg_ghin()} value={r.athletic.ghin} />
          <Field label={m.reg_status()} value={r.athletic.amateurStatus ? m.reg_status_amateur() : m.reg_status_pro()} />
        </dl>
      </ReadSection>

      <ReadSection n={4} title={m.reg_s4_title()}>
        <Rows head={[m.reg_tournament_name(), m.reg_tournament_result()]} rows={r.results.map((x) => [x.tournament, x.result])} />
      </ReadSection>

      <ReadSection n={5} title={m.reg_s5_title()}>
        <Rows head={[m.reg_s5_title(), m.reg_ranking_position()]} rows={r.rankings.map((x) => [x.name, x.position])} />
      </ReadSection>

      <ReadSection n={6} title={m.reg_s6_title()}>
        <Rows head={[m.reg_event_name(), m.reg_event_date()]} rows={r.calendar.map((x) => [x.event, x.date])} />
      </ReadSection>

      <ReadSection n={7} title={m.reg_s7_title()}>
        <p className="max-w-[62ch] text-[14.5px] leading-relaxed font-light whitespace-pre-wrap">{r.motivationLetter || m.detail_empty()}</p>
      </ReadSection>

      <ReadSection n={8} title={m.reg_s8_title()}>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label={m.reg_ck_rules()} value={r.confirmations.rules ? yes : no} />
          <Field label={m.reg_ck_scholarship()} value={r.confirmations.scholarshipUnderstood ? yes : no} />
          <Field label={m.reg_ck_privacy()} value={r.confirmations.privacy ? yes : no} />
        </dl>
      </ReadSection>
    </article>
  )
}
```

- [ ] **Step 7: The route**

```tsx
// src/routes/administracion.registros.$id.tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as m from '../paraglide/messages.js'
import DecisionPanel from '../components/Admin/DecisionPanel'
import NoTools from '../components/Admin/NoTools'
import RegistrationDetail from '../components/Admin/RegistrationDetail'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'

export const Route = createFileRoute('/administracion/registros/$id')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.regs_title() }) }] }),
  component: DetailPage,
})

function DetailPage() {
  const { id } = Route.useParams()
  const me = useMe()
  const detail = useQuery(api.registrations.detail, me && can(me.roles, 'review_registrations') ? { id: id as Id<'registrations'> } : 'skip')
  const decide = useMutation(api.registrations.decide)
  const sendRejection = useMutation(api.notices.sendRejection)

  if (!me) return null
  if (!can(me.roles, 'review_registrations')) return <NoTools />
  if (detail === undefined) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  const r = detail.registration
  return (
    <>
      <Link to="/administracion/registros" className="mt-6 inline-block text-[13px] text-soft no-underline hover:text-ink">
        ← {m.detail_back()}
      </Link>
      <h2 className="h-display mt-3 text-[clamp(22px,3.6vw,30px)]">{r.personal.name || detail.account.email}</h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <RegistrationDetail detail={detail} />
        <DecisionPanel
          status={r.status}
          guardianConfirmed={detail.guardian.confirmed}
          notice={r.decisionNotice?.status ?? null}
          permissions={me.permissions}
          log={detail.log}
          onDecide={async (decision, note) => {
            await decide({ id: r._id, decision, note: note || undefined })
          }}
          onSendRejection={async () => {
            await sendRejection({ id: r._id })
          }}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 8: Generate, check, verify**

Run: `npm run generate-routes && npm run check`
Expected: green.

In the browser as master_admin, open a submitted registration: all eight sections on one page, panel on the right. "Rechazar" without a note → error text under the box; with a note → status chip flips, log shows your name, "Enviar correo de rechazo" appears. Press it → notice chip goes to "enviado", the button disappears, the decision buttons now only include what a locked state allows (master_admin + note). In *Todos* the row now shows a notice chip and (as master_admin) a checkbox; select it, "Enviar correos" → dialog says the window is open (dev cycle) and the Send button is disabled; "Enviarme una prueba" → a `[PRUEBA]` email is queued to your address.

- [ ] **Step 9: Commit**

```bash
git add 'src/routes/administracion.registros.$id.tsx' src/components/Admin src/routeTree.gen.ts messages tests/components/DecisionPanel.test.tsx
git commit -m "feat(admin): single-page registration detail with decision panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Docs and PR

**Files:**
- Modify: `docs/DEPLOYMENT.md` §4, `docs/DECISIONS.md`

- [ ] **Step 1: `docs/DEPLOYMENT.md` §4**

Replace the whole "## 4. Council review" section with:

```markdown
## 4. Council review

The review happens in the app: `/administracion/registros` (an account with
`review_registrations`). *Pendientes* is what is left to screen; each row
opens on one page with the decision panel.

- Administration validates or rejects. A rejection needs a note and may be
  emailed individually at any time.
- A `master_admin` marks the Council's `selected` / `not_selected` from the
  validated ones, then sends the batch from *Todos* — refused while the
  window is open, with a "send me a test" button beside it.
- Once a notice is sent the decision is locked; only a `master_admin` can
  change it, with a note, and the corrected email is never sent on its own.

Delivery shows per row (`enviado` → `entregado` / `rebotó`) from the Resend
webhook; a bounce means the family did not hear, and someone calls.
```

- [ ] **Step 2: `docs/DECISIONS.md`**

Replace "**The launch scope is registration and data capture.** The admin table comes later…" with:

```markdown
**Two decision stages, four terminal states.** Administration screens
(`validated` / `rejected`); the Council's selection is recorded by a
`master_admin` (`selected` / `not_selected`). The acceptance email is about
selection — "accepted" to two hundred screened people who then do not make
twenty-five is the worst email this system could send. Rules:
`convex/lib/decisionRules.ts`.

**A guardian who never confirms holds the registration, never rejects it —
and never lets it be selected.** A submitted registration without the
guardian's confirmation may be validated (it stays flagged) but cannot be
`selected`: a minor does not enter the program without consent. This closes
the open item below.

**Decisions lock once their email is sent.** Changing one needs a
`master_admin` and a note, resets the notice, and never re-sends on its own.
```

Remove open item 2 from "Open items" and renumber.

- [ ] **Step 3: Check, commit, PR**

Run: `npm run check`
Expected: green.

```bash
git add docs/DEPLOYMENT.md docs/DECISIONS.md
git commit -m "docs: review in the app; guardian policy decided; decisions lock after notice

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin feat/admin-review
gh pr create --title "feat: registrations review, selection, and decision emails" --body "$(cat <<'EOF'
## Summary
- `selected` / `not_selected` statuses, `decisionLog`, `decisionNotice`; `registrations.listForAdmin({cycle})`, `detail`, `decide` behind `convex/lib/decisionRules.ts`
- three decision emails; `notices.sendRejection` (individual), `sendBatch` (master_admin, after close), `sendTest`; delivery status from the Resend webhook
- `/administracion/registros` with Pendientes / Todos / Incompletos, filters, sections-complete `n/7`, row selection + batch dialog
- `/administracion/registros/$id` single-page read layout with the decision panel

Spec: docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md §5–§6

## Test plan
- [ ] `npm run check`
- [ ] reviewer: validate / reject (note required) / send rejection; cannot select
- [ ] master_admin: select only from validated; blocked while guardian unconfirmed; batch refused while window open; test email arrives
- [ ] Resend webhook moves a notice to delivered / bounced
- [ ] admin account cannot change a decision whose notice was sent

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage.** §5 data (T2), transitions + guardian + lock (T1, T2), sections complete (T1), `listForAdmin`/`detail` (T2), table views/columns/selection (T4, T5), detail layout + panel (T6). §6 three copies, individual/batch/test, window check, skip non-pending, delivery status (T3, T5). §4 `registros` routes and nav (T5, T6). Docs (T7).

**Placeholders.** `Parameters<Parameters<…>>` in T3 and `as never` in T5 each carry their concrete replacement in the same step. The `resend.sendEmail` return-value check in T3 step 1 names the fallback.

**Type consistency.** `checkDecision` input shape is identical in T1 tests, T2 `decide`, and T6 panel. `NoticeStatus | null` for `notice` everywhere. `AdminRow` (T4) matches `listForAdmin`'s row (T2) field for field. `sendBatch` returns `{ sent, skipped }`, consumed by `BatchSendDialog.onConfirm`.
