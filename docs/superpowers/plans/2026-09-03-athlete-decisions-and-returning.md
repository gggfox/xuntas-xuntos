# Athlete Decisions and Returning Registrants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the athlete their decision only once its email went out, let an existing account start a new cycle's registration prefilled from the last one, and recompute minor status per cycle without touching the frozen signup value.

**Architecture:** Three small changes on the athlete side of what Plans 1–3 built. `users.myStatus` gains a `decision` that is non-null only when `decisionNotice.status !== 'not_sent'`, so the panel and the email cannot disagree. `registrations.mine` returns `previous` when the active cycle has no registration; the panel seeds the form from it. The first write of a registration in a cycle stores `wasMinorAtCycleStart` from `users.birthDate` at the cycle's opening day and opens a guardian authorization for that cycle by copying the last one.

**Tech Stack:** Convex 1.45, React 19, TanStack Start/Router 1.x, Paraglide 2.24, Vitest 3.2.

**Spec:** [`docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md`](../specs/2026-09-03-admin-roles-cycles-review-design.md) §7. Requires Plans 1–3 merged.

## Global Constraints

- **Branch:** `feat/athlete-decisions`, cut from `main` after Plan 3 merges. One PR. `npm run check` green before every commit.
- **`users.wasMinorAtSignup` is never rewritten.** The consent trail for 2026 stays exactly as it is.
- **Rules modules import nothing** from `convex/_generated`, `convex/values`, or Paraglide.
- **All user-facing strings** go through Paraglide, both files. `AccountStatus.tsx` currently holds hardcoded Spanish literals; this plan moves them onto the `status_*` keys that already exist.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```

---

## File structure

| File | Responsibility |
|---|---|
| `convex/lib/guardianRules.ts` | `minorAtCycleStart(birthDate, opensAtMs)`. Pure. |
| `convex/users.ts` | `myStatus.decision`; `openGuardianAuthorization` exported for reuse. |
| `convex/registrations.ts` | `mine.previous`; per-cycle minor + guardian on first write. |
| `src/components/MyRegistration/AccountStatus.tsx` | Decision chip; literals → messages. |
| `src/components/MyRegistration/RegistrationPanel.tsx` | Seeds from `previous`; returning copy. |
| `messages/es.json`, `messages/en.json` | Decision and returning strings. |
| `docs/DECISIONS.md` | Per-cycle minor status. |
| `tests/guardianRules.test.ts`, `tests/components/AccountStatus.test.tsx`, `tests/components/RegistrationPanel.test.tsx` | Tests. |

---

### Task 1: Decision visible only after the notice

**Files:**
- Modify: `convex/users.ts` (`myStatus`)
- Modify: `src/components/MyRegistration/AccountStatus.tsx`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/components/AccountStatus.test.tsx`

**Interfaces:**
- `myStatus.registration` gains `decision: { decision: 'rejected' | 'selected' | 'not_selected'; noticeStatus: NoticeStatus } | null`.
- `AccountStatus` props unchanged; renders a fourth chip when `status.registration?.decision` is set.

- [ ] **Step 1: Messages**

`es.json` (the `status_*` keys already exist; add):

```json
  "status_decision_rejected": "Registro no aceptado",
  "status_decision_selected": "Seleccionado por el Consejo",
  "status_decision_not_selected": "No seleccionado en esta convocatoria",
  "status_decision_help": "Te enviamos un correo con los detalles.",
```

`en.json`:

```json
  "status_decision_rejected": "Registration not accepted",
  "status_decision_selected": "Selected by the Council",
  "status_decision_not_selected": "Not selected this call",
  "status_decision_help": "We sent you an email with the details.",
```

- [ ] **Step 2: Failing test**

```tsx
// tests/components/AccountStatus.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import AccountStatus from '../../src/components/MyRegistration/AccountStatus'
import type { MyStatus } from '../../src/components/MyRegistration/AccountStatus'

const base: MyStatus = {
  account: { name: 'Ana', email: 'a@x', emailVerified: true, roles: ['athlete'], ageDeclared: true, isMinor: false },
  guardian: { required: false, confirmed: true },
  registration: { status: 'rejected', submittedAt: 1, updatedAt: 1, decision: null },
}

describe('AccountStatus', () => {
  it('uses the message functions, never a literal', () => {
    render(<AccountStatus status={base} alreadySubmitted />)
    expect(screen.getByText(m.status_email_verified())).toBeInTheDocument()
    expect(screen.getByText(m.status_submitted())).toBeInTheDocument()
  })

  /** A rejection nobody has been emailed about is not shown: panel and email must agree. */
  it('hides a decision whose notice has not been sent', () => {
    render(<AccountStatus status={base} alreadySubmitted />)
    expect(screen.queryByText(m.status_decision_rejected())).not.toBeInTheDocument()
  })

  it('shows the decision once the notice went out', () => {
    render(
      <AccountStatus
        status={{ ...base, registration: { ...base.registration!, decision: { decision: 'selected', noticeStatus: 'sent' } } }}
        alreadySubmitted
      />,
    )
    expect(screen.getByText(m.status_decision_selected())).toBeInTheDocument()
    expect(screen.getByText(m.status_decision_help())).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/components/AccountStatus.test.tsx`
Expected: FAIL — `decision` is not on the type, and the literals do not match the messages.

- [ ] **Step 4: `myStatus`**

In `convex/users.ts` `myStatus`, replace the `registration:` branch with:

```ts
      registration: registration
        ? {
            status: registration.status,
            submittedAt: registration.submittedAt,
            updatedAt: registration.updatedAt,
            /**
             * Only once the email went out. Otherwise someone refreshes on
             * September 20 and learns they were rejected from a chip, days
             * before the letter that explains it.
             */
            decision:
              registration.decisionNotice && registration.decisionNotice.status !== 'not_sent'
                ? {
                    decision: registration.decisionNotice.decision,
                    noticeStatus: registration.decisionNotice.status,
                  }
                : null,
          }
        : null,
```

- [ ] **Step 5: `AccountStatus.tsx`**

```tsx
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'

export type MyStatus = NonNullable<FunctionReturnType<typeof api.users.myStatus>>

type Props = {
  status: MyStatus
  alreadySubmitted: boolean
}

const DECISION: Record<'rejected' | 'selected' | 'not_selected', { label: () => string; cls: string }> = {
  rejected: { label: m.status_decision_rejected, cls: 'chip chip-bad' },
  selected: { label: m.status_decision_selected, cls: 'chip chip-y' },
  not_selected: { label: m.status_decision_not_selected, cls: 'chip' },
}

/**
 * The three status axes, visible at once — and the decision, once it has
 * been said in an email. The person filling this out needs to know at a
 * glance what they are missing and what depends on someone else.
 */
export default function AccountStatus({ status, alreadySubmitted }: Props) {
  const decision = status.registration?.decision
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className={status.account.emailVerified ? 'chip chip-ok' : 'chip chip-warn'}>
        {status.account.emailVerified ? m.status_email_verified() : m.status_email_unverified()}
      </span>
      {status.guardian.required && (
        <span className={status.guardian.confirmed ? 'chip chip-ok' : 'chip chip-bad'}>
          {status.guardian.confirmed ? m.status_guardian_ok() : m.status_guardian_missing()}
        </span>
      )}
      <span className={alreadySubmitted ? 'chip chip-ok' : 'chip'}>
        {alreadySubmitted ? m.status_submitted() : m.status_draft()}
      </span>
      {decision && (
        <>
          <span className={DECISION[decision.decision].cls}>{DECISION[decision.decision].label()}</span>
          <span className="text-[12px] text-soft">{m.status_decision_help()}</span>
        </>
      )}
    </div>
  )
}
```

`alreadySubmitted` in `RegistrationPanel` currently checks `submitted || validated`; widen it to every non-draft status: `mine.registration !== null && mine.registration.status !== 'draft'`.

- [ ] **Step 6: Run tests, check, commit**

Run: `npx vitest run tests/components/AccountStatus.test.tsx && npm run check`
Expected: PASS (3 tests); green.

```bash
git add convex/users.ts src/components/MyRegistration/AccountStatus.tsx src/components/MyRegistration/RegistrationPanel.tsx messages tests/components/AccountStatus.test.tsx
git commit -m "feat(athlete): decision chip, shown only once its email went out

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Returning registrants

**Files:**
- Modify: `convex/registrations.ts` (`mine`)
- Modify: `src/components/MyRegistration/RegistrationPanel.tsx`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `tests/components/RegistrationPanel.test.tsx` (extend)

**Interfaces:**
- `registrations.mine` → `{ registration, editable, closesAt, cycle, previous: { cycle: string; personal; academic; athletic } | null }` — `previous` is the most recent registration in another cycle, only when `registration` is null.

- [ ] **Step 1: Messages**

`es.json`:

```json
  "returning_title": "Ya te registraste en la {cycle}",
  "returning_text": "Copiamos tus datos personales, escolares y de club. Los resultados, rankings, calendario y carta empiezan en blanco: son de este año.",
```

`en.json`:

```json
  "returning_title": "You registered in the {cycle} call",
  "returning_text": "We copied your personal, school and club details. Results, rankings, schedule and letter start blank: they belong to this year.",
```

- [ ] **Step 2: Failing test**

Add to `tests/components/RegistrationPanel.test.tsx` (the mock from Plan 1 answers per query name):

```tsx
describe('returning athletes', () => {
  it('seeds the form from last cycle and says so', () => {
    statusResult = {
      account: { roles: ['athlete'], emailVerified: true, ageDeclared: true, isMinor: false },
      guardian: { required: false, confirmed: true },
      registration: null,
    }
    queryResult = {
      registration: null,
      editable: true,
      closesAt: 0,
      cycle: '2027-2028',
      previous: {
        cycle: '2026-2027',
        personal: { name: 'Ana Gómez', email: 'ana@x.org', whatsapp: '5512345678', birthDate: '2008-04-11', branch: 'womens', state: 'Nuevo León', city: 'Monterrey' },
        academic: { school: 'ITESM', grade: '11' },
        athletic: { club: 'Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true },
      },
    }
    render(<RegistrationPanel />)
    expect(screen.getByText(m.returning_title({ cycle: '2026-2027' }))).toBeInTheDocument()
    expect(screen.getByDisplayValue('Campestre')).toBeInTheDocument()
  })
})
```

(The form's first step renders `personal.*`; `athletic.club` is on step 3. If `getByDisplayValue('Campestre')` cannot find it because step 1 is showing, assert `getByDisplayValue('Ana Gómez')` instead — the seed is the thing under test, not the step.)

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/components/RegistrationPanel.test.tsx`
Expected: the new test FAILS (no returning title, empty form).

- [ ] **Step 4: `mine.previous`**

In `convex/registrations.ts` `mine`, after `registration` is fetched:

```ts
    /**
     * A returning athlete: identity data barely changes, everything that is
     * evidence of THIS year must be fresh. Only the three identity sections
     * travel; the panel starts the rest empty.
     */
    let previous = null
    if (!registration) {
      const others = await ctx.db
        .query('registrations')
        .withIndex('by_user_cycle', (q) => q.eq('userId', user._id))
        .collect()
      const last = others.filter((r) => r.cycle !== cycle.cycle).sort((a, b) => b.cycle.localeCompare(a.cycle))[0]
      if (last) {
        previous = { cycle: last.cycle, personal: last.personal, academic: last.academic, athletic: last.athletic }
      }
    }
```

and add `previous,` to the returned object.

- [ ] **Step 5: The panel**

In `RegistrationPanel.tsx`, replace the `initial` computation's `emptyRegistration(...)` branch with:

```ts
    : mine.previous
      ? {
          ...emptyRegistration(),
          personal: { ...mine.previous.personal, email: user?.primaryEmailAddress?.emailAddress ?? mine.previous.personal.email },
          academic: { ...mine.previous.academic },
          athletic: { ...mine.previous.athletic },
        }
      : emptyRegistration({
          name: user?.fullName ?? '',
          email: user?.primaryEmailAddress?.emailAddress ?? '',
        })
```

and render, between `<AccountStatus …/>` and `<GuardianNotice />`:

```tsx
      {!mine.registration && mine.previous && (
        <section className="nota mt-6 max-w-[62ch]">
          <b className="mb-1.5 block font-disp text-[14.5px]">{m.returning_title({ cycle: mine.previous.cycle })}</b>
          <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">{m.returning_text()}</p>
        </section>
      )}
```

- [ ] **Step 6: Run tests, check, commit**

Run: `npx vitest run tests/components/RegistrationPanel.test.tsx && npm run check`
Expected: PASS; green.

```bash
git add convex/registrations.ts src/components/MyRegistration/RegistrationPanel.tsx messages tests/components/RegistrationPanel.test.tsx
git commit -m "feat(athlete): returning registrants start the new cycle prefilled

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Minor status per cycle

**Files:**
- Modify: `convex/lib/guardianRules.ts`
- Modify: `convex/users.ts` (export `openGuardianAuthorization`), `convex/registrations.ts`
- Test: `tests/guardianRules.test.ts` (extend)

**Interfaces:**
- `minorAtCycleStart(birthDate: string | undefined, opensAtMs: number): boolean | undefined` — `undefined` when no birth date.
- `openGuardianAuthorization(ctx, { userId, guardianName, guardianEmail, athleteName }, cycle)` exported from `users.ts` (it already exists as a module-private function; Plan 2 gave it the `cycle` parameter).
- `registrations.saveDraft` / `submit`: on **insert** (no existing row), compute `wasMinorAtCycleStart` and, when true and no `guardianAuth` for `(user, cycle)`, copy the most recent `guardianAuth` of the user into a new one and send the email.

- [ ] **Step 1: Failing test**

Append to `tests/guardianRules.test.ts`:

```ts
import { minorAtCycleStart } from '../convex/lib/guardianRules'

describe('minorAtCycleStart', () => {
  /** September 4, 2026, 00:00 Mexico City. */
  const OPENS_2026 = Date.parse('2026-09-04T06:00:00.000Z')
  /** September 4, 2027. */
  const OPENS_2027 = Date.parse('2027-09-04T06:00:00.000Z')

  it('is the age at the opening day, so someone can stop being a minor between cycles', () => {
    expect(minorAtCycleStart('2008-12-01', OPENS_2026)).toBe(true)
    expect(minorAtCycleStart('2008-12-01', OPENS_2027)).toBe(false)
  })

  it('is unknown without a birth date', () => {
    expect(minorAtCycleStart(undefined, OPENS_2026)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/guardianRules.test.ts`
Expected: FAIL — `minorAtCycleStart` is not exported.

- [ ] **Step 3: The rule**

Append to `convex/lib/guardianRules.ts`:

```ts
import { isUnderage } from './cycle'

/**
 * Whether the athlete is a minor on the day the cycle opens.
 *
 * `users.wasMinorAtSignup` is frozen on purpose — it is the 2026 consent
 * trail. This is the per-cycle answer, stored on the registration, so a
 * seventeen-year-old from 2026 who is eighteen in 2027 is not asked for a
 * guardian again, and a sixteen-year-old is.
 */
export function minorAtCycleStart(birthDate: string | undefined, opensAtMs: number): boolean | undefined {
  if (birthDate === undefined) return undefined
  return isUnderage(birthDate, opensAtMs)
}
```

(Move the import to the top of the file with the others.)

- [ ] **Step 4: Wire it into the first write**

In `convex/users.ts`, export `openGuardianAuthorization` (add `export` to its declaration).

In `convex/registrations.ts`, add above `saveDraft`:

```ts
import { minorAtCycleStart } from './lib/guardianRules'
import { openGuardianAuthorization } from './users'
import { windowOf } from './lib/cycleRules'

/**
 * What the first write of a registration in a cycle settles: the age at the
 * opening day, and — for a minor — a guardian authorization for THIS cycle,
 * copied from the last one so the family is not asked to retype it. The
 * 2026 trail is never touched.
 */
async function firstWriteInCycle(
  ctx: MutationCtx,
  user: Doc<'users'>,
  cycle: Doc<'cycles'>,
): Promise<{ wasMinorAtCycleStart?: boolean }> {
  const wasMinor = minorAtCycleStart(user.birthDate, windowOf(cycle).opensAtMs)
  if (wasMinor) {
    const already = await ctx.db
      .query('guardianAuth')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', cycle.cycle))
      .unique()
    if (!already) {
      const past = await ctx.db
        .query('guardianAuth')
        .withIndex('by_user_cycle', (q) => q.eq('userId', user._id))
        .collect()
      const last = past.sort((a, b) => b.sentAt - a.sentAt)[0]
      if (last) {
        await openGuardianAuthorization(
          ctx,
          { userId: user._id, guardianName: last.guardianName, guardianEmail: last.guardianEmail, athleteName: user.name ?? user.email },
          cycle,
        )
      }
    }
  }
  return { wasMinorAtCycleStart: wasMinor }
}
```

(`MutationCtx` from `./_generated/server`; `Doc` is already imported.) In `saveDraft`'s insert and `submit`'s insert branch, spread `...(await firstWriteInCycle(ctx, user, cycle))` into the inserted document. `users.ts` imports nothing from `registrations.ts`, so this direction is cycle-free.

- [ ] **Step 5: Run tests, check, verify**

Run: `npx vitest run tests/guardianRules.test.ts && npm run check && npx convex dev --once`
Expected: PASS (existing + 2); green.

Verify in dev: create a second cycle `2027-2028` in `/administracion/convocatorias` with a window that is open now, activate it, sign in as an athlete who was a minor with a confirmed guardian in 2026-2027 and start the new registration. Expected: the returning notice, `registrations.wasMinorAtCycleStart` set on the new row, a new `guardianAuth` row for `2027-2028` copied from the old one with `timesSent: 1`, the 2026 row untouched, `users.wasMinorAtSignup` untouched. Reactivate 2026-2027 afterwards.

- [ ] **Step 6: Commit**

```bash
git add convex/lib/guardianRules.ts convex/users.ts convex/registrations.ts tests/guardianRules.test.ts
git commit -m "feat(athlete): minor status per cycle, guardian authorization copied forward

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Docs and PR

**Files:**
- Modify: `docs/DECISIONS.md`

- [ ] **Step 1: Amend**

Under "## Data", replace "**`wasMinorAtSignup` is frozen.**…" with:

```markdown
**`wasMinorAtSignup` is frozen; `registrations.wasMinorAtCycleStart` is
per cycle.** The signup value is the 2026 consent trail and is never
recomputed. Each cycle's registration records the age at that cycle's opening
day, so someone who turned eighteen between calls is not asked for a
guardian again, and a minor is — with the authorization copied from the last
cycle so nobody retypes it.

**The athlete sees a decision only after its email.** `users.myStatus`
exposes `decision` only when `decisionNotice.status` is not `not_sent`. The
panel and the letter always agree.

**Returning registrants are prefilled from identity data only.** Personal,
academic and athletic sections carry over; results, rankings, calendar,
letter and confirmations start empty — they are evidence of this year.
```

- [ ] **Step 2: Check, commit, PR**

Run: `npm run check`
Expected: green.

```bash
git add docs/DECISIONS.md
git commit -m "docs: per-cycle minor status, decisions after notice, returning registrants

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin feat/athlete-decisions
gh pr create --title "feat: athlete sees decisions after notice; returning registrants; per-cycle minor status" --body "$(cat <<'EOF'
## Summary
- `myStatus.decision` only once the notice was sent; `AccountStatus` chip (and its literals moved onto messages)
- `registrations.mine.previous` seeds a new cycle's form from the last one (identity sections only)
- `wasMinorAtCycleStart` on the registration; guardian authorization copied forward for minors; `wasMinorAtSignup` untouched

Spec: docs/superpowers/specs/2026-09-03-admin-roles-cycles-review-design.md §7

## Test plan
- [ ] `npm run check`
- [ ] rejected-but-unsent registration shows no decision chip; sent one does
- [ ] returning athlete in a new active cycle sees the notice and prefilled identity sections
- [ ] 2026 minor with confirmed guardian gets a fresh 2027 guardianAuth; 2026 rows unchanged

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage.** §7 decision visibility (T1), returning athletes (T2), minor status per cycle + guardian copy (T3). Docs (T4).

**Placeholders.** None.

**Type consistency.** `myStatus.registration.decision` shape `{ decision, noticeStatus }` is what `AccountStatus` reads and the test builds. `mine.previous` fields `{ cycle, personal, academic, athletic }` match between T2's query, panel, and test. `openGuardianAuthorization(ctx, args, cycle)` argument order follows Plan 2 Task 3 step 7.
