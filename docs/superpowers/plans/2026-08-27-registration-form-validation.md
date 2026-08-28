# Registration Form Validation, Component Split, and Lint Rule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the registration form's submit-only flat-list validation with per-field inline validation shared between client and server, split every multi-component file into one component per file, and add lint enforcement so it stays that way.

**Architecture:** Validation rules move to `convex/lib/` as pure functions returning error *codes*, following the repo's existing `cycle.ts` pattern where `src/lib/` re-exports the backend module so the two cannot drift. The client maps codes to Paraglide messages; the server never produces prose. `RegistrationForm.tsx` (619 lines, 7 components) and `mi-registro.tsx` (7 components) are decomposed into one-component files, and form state moves from hand-rolled `useState` to TanStack Form.

**Tech Stack:** TypeScript 6, React 19, TanStack Start/Router 1.x, TanStack Form 1.33, Convex 1.45, Paraglide (inlang) 2.24, Tailwind v4, Vitest 3.2, ESLint 9 flat config.

**Spec:** [`docs/superpowers/specs/2026-08-27-registration-form-validation-design.md`](../specs/2026-08-27-registration-form-validation-design.md)

## Global Constraints

- **Branch:** `refactor/registration-form-validation`. Four stages, each a separate commit, each leaving `npm run check` green.
- **Do not change** the eight section headings or their approved copy. The comment in `RegistrationForm.tsx` is explicit: changing it reopens a conversation the calendar has no room for.
- **Do not change** the Convex schema or the `registrations` document shape. Drafts saved before this change must load after it.
- **Source of truth for validation** is `convex/lib/`. `src/lib/` modules that mirror backend logic must be re-export shims, never copies. Precedent: `src/lib/cycle.ts`.
- **Rules modules import nothing** from `convex/_generated`, from `convex/values`, or from Paraglide. They must be importable by a plain Node vitest run.
- **All user-facing strings** go through Paraglide. Every new key is added to **both** `messages/es.json` and `messages/en.json`. `es` is `baseLocale`.
- **Error codes are `snake_case` string literals** in a single exported union, `FieldErrorCode` and `ActionErrorCode`, in `convex/lib/errorCodes.ts`.
- **Convex thrown errors** use `ConvexError` with a `{ code }` payload, never `new Error(prose)`. The client reads `err.data.code`.
- **Proposed thresholds P1–P4** (name ≥ 2, WhatsApp ≥ 10 digits, graduation year window, letter minimum) are single named constants in `convex/lib/registrationRules.ts`. Confirm P4 with XUNTAS before Stage 2 ships; if unconfirmed, set `LETTER_MIN = 0`.
- **Test commands:** `npm test` (vitest run), `npm run typecheck`, `npm run lint`, `npm run check` (all three).
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

## Known Limitations (accepted, not fixed here)

- `athletic.amateurStatus` is a `boolean`. "Professional" and "not answered" both serialize to `false`, so a required-ness rule for that field is unwritable without a schema change. Schema changes are a non-goal. `reg_status_error` therefore stays unused and is left in the message files. Fixing it means `v.union(v.literal('amateur'), v.literal('pro'))` and a data migration — a separate piece of work.

---

## File Structure

**Stage 1 — tooling**

| File | Responsibility |
|---|---|
| `eslint.config.js` | Flat config. Ignores generated code. Turns on `react/no-multi-comp` repo-wide and the local filename rule for `src/components/**`. |
| `eslint-rules/component-filename-match.js` | Local rule: a component's name must equal its filename. |
| `eslint-rules/component-filename-match.test.js` | RuleTester unit test for the above. |
| `.vscode/extensions.json` | Recommends the ESLint and Tailwind extensions. |
| `.vscode/settings.json` | Flat config on, ESLint autofix on save. |

**Stage 2 — rules**

| File | Responsibility |
|---|---|
| `convex/lib/errorCodes.ts` | `FieldErrorCode` and `ActionErrorCode` unions. No logic. |
| `convex/lib/registrationSchema.ts` | `RegistrationData`, `Row`, `emptyRegistration`, `emptyRow`, `prepareForSubmit`, `LETTER_LIMIT`, `FIXED_RANKINGS`. Moved from `src/lib/form.ts`. |
| `convex/lib/registrationRules.ts` | Field validators returning `FieldErrorCode`. `validateRegistration` returns a keyed error map. Holds P1–P4 constants. |
| `convex/lib/guardianRules.ts` | `validateBirthDateDeclaration` — birth date plus guardian fields, including the same-email check. |
| `src/lib/registrationSchema.ts` | Re-export shim. |
| `src/lib/registrationRules.ts` | Re-export shim. |
| `src/lib/guardianRules.ts` | Re-export shim. |
| `src/lib/registrationErrors.ts` | Client only. Maps `FieldErrorCode`/`ActionErrorCode` to Paraglide messages; `errorCodeFromConvex` unwraps `ConvexError`. |
| `src/lib/registrationProgress.ts` | `computeProgress`, moved out of the component. |
| ~~`src/lib/form.ts`~~ | Deleted. |

**Stage 3 — split**

| File | Responsibility |
|---|---|
| `src/components/TextField.tsx` | Labelled text input with inline error and aria wiring. Was `Field`. |
| `src/components/SelectField.tsx` | Was `Select`. |
| `src/components/CheckboxField.tsx` | Was `Checkbox`. |
| `src/components/FieldGrid.tsx` | Was `Grid`. |
| `src/components/FieldError.tsx` | Renders one field's error message; owns the `id` that `aria-describedby` points at. |
| `src/components/DynamicRows.tsx` | Growable two-column rows. Was `DynamicRows`. |
| `src/components/FormSection.tsx` | Was `Section`. |
| `src/components/ProgressBar.tsx` | The sticky progress bar, extracted from the form shell. |
| `src/components/ErrorSummary.tsx` | Top-of-form summary; each entry links to its field. |
| `src/components/RegistrationPanel.tsx` | Was `Panel` in `mi-registro.tsx`. |
| `src/components/AccountStatus.tsx` | Was `AccountStatus` in `mi-registro.tsx`. |
| `src/components/GuardianNotice.tsx` | Was `GuardianNotice` in `mi-registro.tsx`. |
| `src/components/SyncingFrame.tsx` | Was `SyncingFrame` in `mi-registro.tsx`. |
| `src/components/PageFrame.tsx` | Replaces the two rival `Frame` components. |
| `src/components/BirthDateForm.tsx` | Replaces the duplicated bodies of `AgeGate` and `BirthDateStep`. |

**Stage 4 — TanStack Form**

| File | Responsibility |
|---|---|
| `src/lib/draftAutosave.ts` | `shouldSaveDraft(next, lastSaved)` — the loop-cut, as a pure function. |
| `src/hooks/useDraftAutosave.ts` | Debounced autosave hook built on `shouldSaveDraft`. |
| `src/components/RegistrationForm.tsx` | Form shell only. `useForm`, sections, submit. |

**Tests**

| File | Covers |
|---|---|
| `tests/registrationRules.test.ts` | Every field rule, valid and invalid. |
| `tests/guardianRules.test.ts` | Birth date and guardian rules, including same-email. |
| `tests/registrationSchema.test.ts` | Renamed from `tests/form.test.ts`. |
| `tests/registrationProgress.test.ts` | Progress calculation. |
| `tests/draftAutosave.test.ts` | The loop-cut, as a pure unit. |
| `tests/components/RegistrationForm.test.tsx` | Inline errors, blur validation, autosave loop in a real render. |
| `tests/components/BirthDateForm.test.tsx` | Guardian fields appear for minors; same-email rejected. |

---

# STAGE 1 — Tooling

### Task 1: ESLint flat config, one component per file

**Files:**
- Create: `eslint.config.js`
- Create: `.vscode/extensions.json`
- Create: `.vscode/settings.json`
- Modify: `package.json` (devDependencies, `lint` script, `check` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run lint`. Task 2 adds a rule to `eslint.config.js`; Stage 3 makes this command pass.

- [ ] **Step 1: Install the dev dependencies**

```bash
npm install -D eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-plugin-react@^7 eslint-plugin-react-hooks@^5 globals@^15
```

- [ ] **Step 2: Write `eslint.config.js`**

```js
// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    // Generated code. Paraglide rewrites `src/paraglide/` on every build and
    // TanStack regenerates `routeTree.gen.ts`; linting them means fixing the
    // same findings after every compile.
    ignores: [
      'src/paraglide/**',
      'src/routeTree.gen.ts',
      'convex/_generated/**',
      'dist/**',
      '.output/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // THE RULE. One component per file, everywhere.
      'react/no-multi-comp': ['error', { ignoreStateless: false }],

      // `_`-prefixed args are the convention for deliberately unused ones.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Tests render more than one component on purpose (harnesses, stubs).
    files: ['tests/**/*.{ts,tsx}'],
    rules: { 'react/no-multi-comp': 'off' },
  },
)
```

- [ ] **Step 3: Add the scripts to `package.json`**

Change the `scripts` block so `lint` exists and `check` runs it first:

```json
    "check": "npm run lint && npm run typecheck && npm run test",
    "lint": "eslint .",
```

- [ ] **Step 4: Run lint and record the violations**

Run: `npm run lint`
Expected: FAIL. `react/no-multi-comp` fires on `src/components/RegistrationForm.tsx`, `src/routes/mi-registro.tsx`, `src/routes/autorizar.$token.tsx`. This failure list is the map for Stage 3 — save it:

```bash
npm run lint 2>&1 | tee /tmp/lint-baseline.txt
```

- [ ] **Step 5: Write `.vscode/extensions.json`**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss"
  ]
}
```

- [ ] **Step 6: Write `.vscode/settings.json`**

```json
{
  "eslint.useFlatConfig": true,
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.eol": "\n"
}
```

- [ ] **Step 7: Verify typecheck and tests still pass**

Run: `npm run typecheck && npm test`
Expected: PASS both. Lint is expected to still fail until Stage 3.

- [ ] **Step 8: Commit**

```bash
git add eslint.config.js .vscode package.json package-lock.json
git commit -m "chore(lint): add eslint flat config with react/no-multi-comp

The rule fires on RegistrationForm.tsx, mi-registro.tsx and
autorizar.\$token.tsx. Those are split in stage 3; until then
\`npm run lint\` is expected to fail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 2: Local rule — filename must match the component name

**Files:**
- Create: `eslint-rules/component-filename-match.js`
- Create: `eslint-rules/component-filename-match.test.js`
- Modify: `eslint.config.js`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: `npm run lint` from Task 1.
- Produces: ESLint rule `local/component-filename-match`, scoped to `src/components/**`.

Route files are deliberately out of scope: TanStack Router names them by URL
(`autorizar.$token.tsx`, `crear-cuenta.index.tsx`), so a filename match is
impossible there by construction.

- [ ] **Step 1: Write the failing rule test**

Create `eslint-rules/component-filename-match.test.js`:

```js
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './component-filename-match.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('component-filename-match', () => {
  it('passes valid cases and rejects invalid ones', () => {
    ruleTester.run('component-filename-match', rule, {
      valid: [
        {
          code: 'export default function TextField() { return null }',
          filename: '/repo/src/components/TextField.tsx',
        },
        {
          code: 'function TextField() { return null }\nexport default TextField',
          filename: '/repo/src/components/TextField.tsx',
        },
        {
          code: 'export function TextField() { return null }',
          filename: '/repo/src/components/TextField.tsx',
        },
        // Not a component file: lowercase helper export, no complaint.
        {
          code: 'export function helper() { return 1 }',
          filename: '/repo/src/components/TextField.tsx',
        },
      ],
      invalid: [
        {
          code: 'export default function Field() { return null }',
          filename: '/repo/src/components/TextField.tsx',
          errors: [{ messageId: 'mismatch' }],
        },
        {
          code: 'export function Select() { return null }',
          filename: '/repo/src/components/SelectField.tsx',
          errors: [{ messageId: 'mismatch' }],
        },
      ],
    })
  })
})
```

- [ ] **Step 2: Point vitest at the rule test**

`vitest.config.ts` currently includes only `tests/**/*.test.ts`. Widen `include`
so the rule's own test runs:

```ts
    include: ['tests/**/*.test.ts', 'eslint-rules/**/*.test.js'],
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run eslint-rules`
Expected: FAIL — cannot resolve `./component-filename-match.js`.

- [ ] **Step 4: Write the rule**

Create `eslint-rules/component-filename-match.js`:

```js
import path from 'node:path'

/**
 * A component's name must equal its filename.
 *
 * Pairs with `react/no-multi-comp`: that rule guarantees one component per
 * file, this one guarantees you can find it from the filename. Together they
 * mean a component's location is derivable from its name and vice versa.
 *
 * Only PascalCase exports are considered components, so a file may still
 * export lowercase helpers alongside its component.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'component name must match its filename' },
    schema: [],
    messages: {
      mismatch:
        "Component '{{component}}' is in '{{basename}}'. Rename the file to '{{component}}.tsx' or rename the component to '{{expected}}'.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()
    const basename = path.basename(filename)
    const expected = basename.replace(/\.[jt]sx?$/, '')

    // Only index-free PascalCase filenames describe a component.
    if (!/^[A-Z]/.test(expected)) return {}

    const isComponentName = (name) => typeof name === 'string' && /^[A-Z]/.test(name)

    function check(node, name) {
      if (!isComponentName(name)) return
      if (name === expected) return
      context.report({
        node,
        messageId: 'mismatch',
        data: { component: name, basename, expected },
      })
    }

    return {
      'ExportDefaultDeclaration > FunctionDeclaration'(node) {
        check(node, node.id?.name)
      },
      'ExportNamedDeclaration > FunctionDeclaration'(node) {
        check(node, node.id?.name)
      },
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(node) {
        check(node, node.id?.name)
      },
      ExportDefaultDeclaration(node) {
        // `function Foo() {}` then `export default Foo`
        if (node.declaration?.type === 'Identifier') {
          check(node, node.declaration.name)
        }
      },
    }
  },
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run eslint-rules`
Expected: PASS, 1 test.

- [ ] **Step 6: Wire the rule into `eslint.config.js`**

Add the import at the top:

```js
import componentFilenameMatch from './eslint-rules/component-filename-match.js'
```

Add a config block after the main `{ files: ['**/*.{ts,tsx}'], ... }` block:

```js
  {
    // Routes are named by URL by TanStack Router (`autorizar.$token.tsx`), so
    // a filename match is impossible there. Components have no such excuse.
    files: ['src/components/**/*.tsx'],
    plugins: { local: { rules: { 'component-filename-match': componentFilenameMatch } } },
    rules: { 'local/component-filename-match': 'error' },
  },
```

- [ ] **Step 7: Verify the rule is live**

Run: `npm run lint 2>&1 | grep -c "component-filename-match" || true`
Expected: `0` — today every file in `src/components/` already matches its
component name, so the rule is green from the start and only guards the future.

- [ ] **Step 8: Commit**

```bash
git add eslint-rules eslint.config.js vitest.config.ts
git commit -m "chore(lint): require component name to match filename

Scoped to src/components/. Routes are exempt: TanStack Router names
them by URL, so a match is impossible by construction.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

# STAGE 2 — Shared rules and error codes

### Task 3: Component test infrastructure

**Files:**
- Modify: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json` (devDependencies)

**Interfaces:**
- Consumes: nothing.
- Produces: a `jsdom` vitest project matching `tests/components/**/*.test.tsx`, with `@testing-library/react` available. Tasks 16–19 depend on it.

`vitest.config.ts` is `environment: 'node'` and includes only `tests/**/*.test.ts`.
Inline errors, blur validation, and the autosave loop cannot be tested under that.
Pure rule tests must stay on `node` — they are fast and have no DOM.

- [ ] **Step 1: Install the dev dependencies**

```bash
npm install -D jsdom@^25 @testing-library/react@^16 @testing-library/dom@^10 @testing-library/user-event@^14 @testing-library/jest-dom@^6
```

- [ ] **Step 2: Write `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest does not unmount between tests on its own, and a left-over tree keeps
// its timers running — which the autosave test would then see.
afterEach(() => {
  cleanup()
})
```

- [ ] **Step 3: Split `vitest.config.ts` into two projects**

Replace the `test` block, keeping the existing comment and the `WINDOW_ALWAYS_OPEN` guard:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * A config separate from `vite.config.ts` on purpose.
 *
 * The production one drags in TanStack Start and Paraglide, and demands the
 * build variables. None of that is needed to test pure functions, and
 * loading it would make the tests slow and fragile.
 */
export default defineConfig({
  test: {
    /**
     * The development escape hatch opens the registration window no matter
     * what. If someone has it set in their shell, the `isWindowOpen` tests
     * would fail because of the environment and not because of the code.
     */
    env: { WINDOW_ALWAYS_OPEN: '' },
    projects: [
      {
        // Pure logic. No DOM, so it stays fast.
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts', 'eslint-rules/**/*.test.js'],
          environment: 'node',
          env: { WINDOW_ALWAYS_OPEN: '' },
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'components',
          include: ['tests/components/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          env: { WINDOW_ALWAYS_OPEN: '' },
        },
      },
    ],
  },
})
```

- [ ] **Step 4: Write a smoke test proving the jsdom project works**

Create `tests/components/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('component test harness', () => {
  it('renders into jsdom', () => {
    render(<p>hola</p>)
    expect(screen.getByText('hola')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS. Both projects report; the existing 24 unit tests still pass and the smoke test passes.

- [ ] **Step 6: Delete the smoke test and re-run**

```bash
rm tests/components/smoke.test.tsx
```

Run: `npm test`
Expected: PASS, 24 unit tests, components project reports no files (not an error).

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json package-lock.json
git commit -m "test: add jsdom project for component tests

Pure rule tests stay on the node project so they stay fast.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 4: Error codes and the schema module

**Files:**
- Create: `convex/lib/errorCodes.ts`
- Create: `convex/lib/registrationSchema.ts`
- Create: `src/lib/registrationSchema.ts`
- Rename: `tests/form.test.ts` → `tests/registrationSchema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type FieldErrorCode` — the union used by every field rule.
  - `type ActionErrorCode` — the union thrown by Convex mutations.
  - `type RegistrationData`, `type Row`, `emptyRow()`, `emptyRegistration(seed?)`, `prepareForSubmit(d)`, `LETTER_LIMIT`, `FIXED_RANKINGS` — all re-exported from `src/lib/registrationSchema.ts`.

`src/lib/form.ts` is not deleted yet; it is emptied in Task 8 once every importer has moved.

- [ ] **Step 1: Write `convex/lib/errorCodes.ts`**

```ts
/**
 * Every error this app can produce, as a code.
 *
 * Rules and mutations return codes, never prose. Prose is the client's job
 * (`src/lib/registrationErrors.ts`), which is what makes a server-side
 * rejection readable in English instead of always Spanish.
 */

/** A rejection attached to one field of a form. */
export type FieldErrorCode =
  | 'name_required'
  | 'name_too_short'
  | 'email_invalid'
  | 'whatsapp_invalid'
  | 'birth_date_required'
  | 'birth_date_future'
  | 'birth_date_implausible'
  | 'branch_required'
  | 'city_required'
  | 'school_required'
  | 'grade_required'
  | 'graduation_year_invalid'
  | 'club_required'
  | 'coach_required'
  | 'ghin_required'
  | 'results_required'
  | 'letter_required'
  | 'letter_too_short'
  | 'letter_too_long'
  | 'confirm_rules_required'
  | 'confirm_scholarship_required'
  | 'confirm_privacy_required'
  | 'guardian_name_required'
  | 'guardian_name_too_long'
  | 'guardian_email_invalid'
  | 'guardian_email_same_as_own'

/** A rejection of the whole action, thrown rather than returned. */
export type ActionErrorCode =
  | 'window_closed'
  | 'already_reviewed'
  | 'birth_date_missing'
  | 'birth_date_locked'
  | 'not_signed_in'
  | 'admin_required'
  | 'guardian_not_required'
  | 'guardian_already_confirmed'
  | 'field_too_long'
  | 'too_many_rows'
  | 'letter_too_long'
  /** Nothing more specific survived the trip. Renders as `err_generic`. */
  | 'generic'

export type AppErrorCode = FieldErrorCode | ActionErrorCode
```

- [ ] **Step 2: Move the schema module to the backend**

```bash
git mv src/lib/form.ts convex/lib/registrationSchema.ts
```

- [ ] **Step 3: Strip Paraglide and validation out of the moved file**

`convex/lib/registrationSchema.ts` must import nothing from Paraglide. Delete
its first line (`import * as m from '../paraglide/messages.js'`) and delete the
whole `validateRegistration` function — it is rewritten in Task 5. Keep
`LETTER_LIMIT`, `FIXED_RANKINGS`, `Row`, `RegistrationData`, `emptyRow`,
`emptyRegistration`, and `prepareForSubmit` exactly as they are.

Update the doc comment on the file to say where it now lives:

```ts
/**
 * Shape of a registration, and the two transforms that go with it.
 *
 * It lives in `convex/lib/` and is re-exported by `src/lib/` for the same
 * reason `cycle.ts` is: the client and the server must not be able to
 * disagree about what a registration is.
 */
```

- [ ] **Step 4: Write the client shim `src/lib/registrationSchema.ts`**

```ts
/**
 * Re-exports the registration shape from the backend.
 *
 * See `convex/lib/registrationSchema.ts`. Nothing here is a copy: a second
 * definition of `RegistrationData` is a second thing to keep in sync.
 */
export {
  LETTER_LIMIT,
  FIXED_RANKINGS,
  emptyRow,
  emptyRegistration,
  prepareForSubmit,
} from '../../convex/lib/registrationSchema'

export type { Row, RegistrationData } from '../../convex/lib/registrationSchema'
```

- [ ] **Step 5: Rename the test and point it at the new module**

```bash
git mv tests/form.test.ts tests/registrationSchema.test.ts
```

Change its import line to:

```ts
import { emptyRegistration, prepareForSubmit } from '../convex/lib/registrationSchema'
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/registrationSchema.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `src/components/RegistrationForm.tsx` and `src/routes/mi-registro.tsx` still import `../lib/form`. Fix both by pointing them at `../lib/registrationSchema`, and temporarily leave `validateRegistration` broken; it is replaced in Task 5. To keep this task's deliverable self-contained, add a stopgap to `src/lib/registrationSchema.ts`:

```ts
// Removed in Task 5, when the real rule module lands.
export function validateRegistration(): string[] {
  return []
}
```

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A convex/lib src/lib src/components src/routes tests
git commit -m "refactor(registration): move the data shape into convex/lib

src/lib/registrationSchema.ts re-exports it, the same way cycle.ts
does, so the client and the server cannot disagree about the shape.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 5: The registration rules

**Files:**
- Create: `convex/lib/registrationRules.ts`
- Create: `src/lib/registrationRules.ts`
- Create: `tests/registrationRules.test.ts`
- Modify: `src/lib/registrationSchema.ts` (remove the Task 4 stopgap)

**Interfaces:**
- Consumes: `FieldErrorCode` from `convex/lib/errorCodes.ts`; `RegistrationData`, `LETTER_LIMIT` from `convex/lib/registrationSchema.ts`; `isValidBirthDate` from `convex/lib/cycle.ts`.
- Produces:
  - `type RegistrationFieldPath` — dotted paths matching TanStack Form field names.
  - `type RegistrationError = { field: RegistrationFieldPath; code: FieldErrorCode }`
  - `validateRegistration(d: RegistrationData): RegistrationError[]` — document order.
  - `toErrorMap(errors: RegistrationError[]): Partial<Record<RegistrationFieldPath, FieldErrorCode>>`
  - Named field validators used by TanStack Form per-field validators: `checkName`, `checkEmail`, `checkWhatsapp`, `checkBirthDate`, `checkBranch`, `checkRequiredText`, `checkGraduationYear`, `checkLetter`.
  - Constants `NAME_MIN`, `WHATSAPP_MIN_DIGITS`, `GRADUATION_YEARS_BACK`, `GRADUATION_YEARS_AHEAD`, `LETTER_MIN`.

- [ ] **Step 1: Write the failing test**

Create `tests/registrationRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { emptyRegistration, LETTER_LIMIT } from '../convex/lib/registrationSchema'
import type { RegistrationData } from '../convex/lib/registrationSchema'
import {
  LETTER_MIN,
  checkBirthDate,
  checkEmail,
  checkGraduationYear,
  checkLetter,
  checkWhatsapp,
  toErrorMap,
  validateRegistration,
} from '../convex/lib/registrationRules'

/** A registration that passes every rule. The base for one-field mutations. */
function validRegistration(): RegistrationData {
  const d = emptyRegistration({
    name: 'Ana Gómez',
    email: 'ana@example.com',
    whatsapp: '+52 55 1234 5678',
    birthDate: '2008-04-11',
    branch: 'womens',
    cityState: 'Monterrey, NL',
  })
  d.academic = { school: 'ITESM', grade: '11', graduationYear: '2027', interest: 'Biología' }
  d.athletic = { club: 'Club Campestre', coach: 'L. Ruiz', ghin: '4.2', amateurStatus: true }
  d.results = [{ tournament: 'CNIJ', result: '2º' }]
  d.motivationLetter = 'x'.repeat(LETTER_MIN || 1)
  d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
  return d
}

describe('validateRegistration', () => {
  it('accepts a complete registration', () => {
    expect(validateRegistration(validRegistration())).toEqual([])
  })

  it('reports errors in document order', () => {
    const d = emptyRegistration()
    const fields = validateRegistration(d).map((e) => e.field)
    expect(fields[0]).toBe('personal.name')
    expect(fields).toContain('confirmations.privacy')
    expect(fields.indexOf('personal.name')).toBeLessThan(fields.indexOf('academic.school'))
  })

  it('keys errors by the field path TanStack Form uses', () => {
    const d = validRegistration()
    d.personal.email = 'not-an-email'
    expect(toErrorMap(validateRegistration(d))).toEqual({ 'personal.email': 'email_invalid' })
  })

  it('rejects a branch that is neither womens nor mens', () => {
    const d = validRegistration()
    d.personal.branch = '' as RegistrationData['personal']['branch']
    expect(toErrorMap(validateRegistration(d))['personal.branch']).toBe('branch_required')
  })

  it('requires at least one fully filled result row', () => {
    const d = validRegistration()
    d.results = [{ tournament: 'CNIJ', result: '' }]
    expect(toErrorMap(validateRegistration(d)).results).toBe('results_required')
  })

  it('reports each unchecked confirmation separately', () => {
    const d = validRegistration()
    d.confirmations = { rules: false, scholarshipUnderstood: false, privacy: false }
    const map = toErrorMap(validateRegistration(d))
    expect(map['confirmations.rules']).toBe('confirm_rules_required')
    expect(map['confirmations.scholarshipUnderstood']).toBe('confirm_scholarship_required')
    expect(map['confirmations.privacy']).toBe('confirm_privacy_required')
  })
})

describe('checkEmail', () => {
  it.each([
    ['ana@example.com', undefined],
    ['  Ana@Example.COM  ', undefined],
    ['', 'email_invalid'],
    ['ana@', 'email_invalid'],
    ['ana example.com', 'email_invalid'],
    ['ana@example', 'email_invalid'],
  ])('%s -> %s', (input, expected) => {
    expect(checkEmail(input)).toBe(expected)
  })
})

describe('checkWhatsapp', () => {
  it.each([
    ['5512345678', undefined],
    ['+52 55 1234 5678', undefined],
    ['(55) 1234-5678', undefined],
    ['', 'whatsapp_invalid'],
    ['12345', 'whatsapp_invalid'],
    ['no soy un teléfono', 'whatsapp_invalid'],
  ])('%s -> %s', (input, expected) => {
    expect(checkWhatsapp(input)).toBe(expected)
  })
})

describe('checkBirthDate', () => {
  const now = Date.parse('2026-08-27T12:00:00.000Z')

  it.each([
    ['2008-04-11', undefined],
    ['', 'birth_date_required'],
    ['2030-01-01', 'birth_date_future'],
    ['1899-01-01', 'birth_date_implausible'],
    ['2008-02-31', 'birth_date_implausible'],
    ['not-a-date', 'birth_date_implausible'],
  ])('%s -> %s', (input, expected) => {
    expect(checkBirthDate(input, now)).toBe(expected)
  })
})

describe('checkGraduationYear', () => {
  const now = Date.parse('2026-08-27T12:00:00.000Z')

  it.each([
    ['', undefined],
    [undefined, undefined],
    ['2027', undefined],
    ['2025', undefined],
    ['1990', 'graduation_year_invalid'],
    ['2099', 'graduation_year_invalid'],
    ['27', 'graduation_year_invalid'],
  ])('%s -> %s', (input, expected) => {
    expect(checkGraduationYear(input, now)).toBe(expected)
  })
})

describe('checkLetter', () => {
  it('accepts a letter within the limits', () => {
    expect(checkLetter('x'.repeat(Math.max(LETTER_MIN, 1)))).toBeUndefined()
  })

  it('rejects an empty letter', () => {
    expect(checkLetter('   ')).toBe('letter_required')
  })

  it('rejects a letter over the cap', () => {
    expect(checkLetter('x'.repeat(LETTER_LIMIT + 1))).toBe('letter_too_long')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/registrationRules.test.ts`
Expected: FAIL — cannot resolve `../convex/lib/registrationRules`.

- [ ] **Step 3: Write the rules module**

Create `convex/lib/registrationRules.ts`:

```ts
import type { AppErrorCode, FieldErrorCode } from './errorCodes'
import { LETTER_LIMIT, type RegistrationData } from './registrationSchema'
import { isValidBirthDate } from './cycle'

/**
 * Validation for a registration, as pure functions returning codes.
 *
 * This module is the source of truth. `convex/registrations.ts` calls it
 * before writing, and the browser calls it through
 * `src/lib/registrationRules.ts` for immediate feedback. They cannot drift
 * because there is only one of them.
 *
 * It imports nothing from Convex and nothing from Paraglide, so it runs in a
 * plain Node test.
 */

// --- thresholds -------------------------------------------------------------
// Product decisions, not technical ones. See "Open decisions" in the design
// doc: each is one constant precisely so XUNTAS can move it in one line.

/** P1 — a single stray character is not a name. */
export const NAME_MIN = 2

/** P2 — Mexican mobile numbers are 10 digits. Separators are stripped first. */
export const WHATSAPP_MIN_DIGITS = 10

/** P3 — someone who already graduated, through someone starting secondary. */
export const GRADUATION_YEARS_BACK = 1
export const GRADUATION_YEARS_AHEAD = 12

/**
 * P4 — minimum letter length.
 *
 * The brief asks for "one page at most, written by you". A floor set too high
 * turns a terse but genuine letter into an error, so this is the threshold
 * most worth questioning. Set it to 0 to keep only the upper cap.
 */
export const LETTER_MIN = 200

// --- field paths ------------------------------------------------------------

/**
 * Dotted paths, matching the `name` TanStack Form gives each field, so a
 * validation result maps straight onto the form without translation.
 */
export type RegistrationFieldPath =
  | 'personal.name'
  | 'personal.email'
  | 'personal.whatsapp'
  | 'personal.birthDate'
  | 'personal.branch'
  | 'personal.cityState'
  | 'academic.school'
  | 'academic.grade'
  | 'academic.graduationYear'
  | 'athletic.club'
  | 'athletic.coach'
  | 'athletic.ghin'
  | 'results'
  | 'motivationLetter'
  | 'confirmations.rules'
  | 'confirmations.scholarshipUnderstood'
  | 'confirmations.privacy'
  /**
   * Not a field. It is what a rejection of the whole action attaches to — the
   * window closed, the registration was already reviewed — so such an error
   * can ride in the same list instead of needing a second channel.
   */
  | 'form'

export type RegistrationError = {
  field: RegistrationFieldPath
  /**
   * `AppErrorCode`, not `FieldErrorCode`: the rules only ever produce field
   * codes, but `submit` returns action codes in this same shape.
   */
  code: AppErrorCode
}

// --- field rules ------------------------------------------------------------
// Each returns `undefined` when the value is acceptable. That is the shape
// TanStack Form wants from a field validator.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function checkName(value: string): FieldErrorCode | undefined {
  const v = value.trim()
  if (!v) return 'name_required'
  if (v.length < NAME_MIN) return 'name_too_short'
  return undefined
}

export function checkEmail(value: string): FieldErrorCode | undefined {
  return EMAIL_RE.test(value.trim()) ? undefined : 'email_invalid'
}

/**
 * Counts digits, having thrown away the punctuation people actually type.
 * `+52 55 1234 5678` and `(55) 1234-5678` are the same number.
 */
export function checkWhatsapp(value: string): FieldErrorCode | undefined {
  const digits = value.replace(/\D/g, '')
  return digits.length >= WHATSAPP_MIN_DIGITS ? undefined : 'whatsapp_invalid'
}

export function checkBirthDate(value: string, now: number = Date.now()): FieldErrorCode | undefined {
  const v = value.trim()
  if (!v) return 'birth_date_required'
  // `isValidBirthDate` folds "not a real date", "in the future" and "before
  // 1930" into one boolean. Split them so the message can be specific.
  if (isValidBirthDate(v, now)) return undefined
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (parsed && Date.UTC(Number(parsed[1]), Number(parsed[2]) - 1, Number(parsed[3])) > now) {
    return 'birth_date_future'
  }
  return 'birth_date_implausible'
}

export function checkBranch(value: string): FieldErrorCode | undefined {
  return value === 'womens' || value === 'mens' ? undefined : 'branch_required'
}

/** The shared shape of the six plain required text fields. */
export function checkRequiredText(
  value: string,
  code: FieldErrorCode,
): FieldErrorCode | undefined {
  return value.trim() ? undefined : code
}

export function checkGraduationYear(
  value: string | undefined,
  now: number = Date.now(),
): FieldErrorCode | undefined {
  const v = (value ?? '').trim()
  if (!v) return undefined // optional
  if (!/^\d{4}$/.test(v)) return 'graduation_year_invalid'
  const year = Number(v)
  const thisYear = new Date(now).getUTCFullYear()
  if (year < thisYear - GRADUATION_YEARS_BACK) return 'graduation_year_invalid'
  if (year > thisYear + GRADUATION_YEARS_AHEAD) return 'graduation_year_invalid'
  return undefined
}

export function checkLetter(value: string): FieldErrorCode | undefined {
  const v = value.trim()
  if (!v) return 'letter_required'
  if (v.length < LETTER_MIN) return 'letter_too_short'
  if (value.length > LETTER_LIMIT) return 'letter_too_long'
  return undefined
}

// --- the whole form ---------------------------------------------------------

/**
 * Errors in document order, so the summary at the top of the form reads in
 * the same order as the form itself.
 */
export function validateRegistration(
  d: RegistrationData,
  now: number = Date.now(),
): RegistrationError[] {
  const errors: RegistrationError[] = []
  const push = (field: RegistrationFieldPath, code: FieldErrorCode | undefined) => {
    if (code) errors.push({ field, code })
  }

  push('personal.name', checkName(d.personal.name))
  push('personal.email', checkEmail(d.personal.email))
  push('personal.whatsapp', checkWhatsapp(d.personal.whatsapp))
  push('personal.birthDate', checkBirthDate(d.personal.birthDate, now))
  push('personal.branch', checkBranch(d.personal.branch))
  push('personal.cityState', checkRequiredText(d.personal.cityState, 'city_required'))

  push('academic.school', checkRequiredText(d.academic.school, 'school_required'))
  push('academic.grade', checkRequiredText(d.academic.grade, 'grade_required'))
  push('academic.graduationYear', checkGraduationYear(d.academic.graduationYear, now))

  push('athletic.club', checkRequiredText(d.athletic.club, 'club_required'))
  push('athletic.coach', checkRequiredText(d.athletic.coach, 'coach_required'))
  push('athletic.ghin', checkRequiredText(d.athletic.ghin, 'ghin_required'))

  if (!d.results.some((r) => r.tournament.trim() && r.result.trim())) {
    push('results', 'results_required')
  }

  push('motivationLetter', checkLetter(d.motivationLetter))

  // Each box gets its own error. The old code pushed the box's LABEL as the
  // error text, so the list read as a set of statements rather than problems.
  if (!d.confirmations.rules) push('confirmations.rules', 'confirm_rules_required')
  if (!d.confirmations.scholarshipUnderstood) {
    push('confirmations.scholarshipUnderstood', 'confirm_scholarship_required')
  }
  if (!d.confirmations.privacy) push('confirmations.privacy', 'confirm_privacy_required')

  return errors
}

/** Lookup by field, for rendering an error next to its input. */
export function toErrorMap(
  errors: RegistrationError[],
): Partial<Record<RegistrationFieldPath, AppErrorCode>> {
  const map: Partial<Record<RegistrationFieldPath, AppErrorCode>> = {}
  for (const e of errors) map[e.field] ??= e.code
  return map
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/registrationRules.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Write the client shim `src/lib/registrationRules.ts`**

```ts
/**
 * Re-exports the registration rules from the backend.
 *
 * See `convex/lib/registrationRules.ts`. The browser validating with a
 * different set of rules than the server enforces is the bug this prevents.
 */
export {
  NAME_MIN,
  WHATSAPP_MIN_DIGITS,
  LETTER_MIN,
  checkName,
  checkEmail,
  checkWhatsapp,
  checkBirthDate,
  checkBranch,
  checkRequiredText,
  checkGraduationYear,
  checkLetter,
  validateRegistration,
  toErrorMap,
} from '../../convex/lib/registrationRules'

export type {
  RegistrationError,
  RegistrationFieldPath,
} from '../../convex/lib/registrationRules'
```

- [ ] **Step 6: Remove the Task 4 stopgap**

Delete the temporary `validateRegistration` from `src/lib/registrationSchema.ts`.

- [ ] **Step 7: Run the full unit suite**

Run: `npx vitest run --project unit`
Expected: PASS. `typecheck` fails until Task 8 rewires the callers — that is expected and is fixed there.

- [ ] **Step 8: Commit**

```bash
git add convex/lib/registrationRules.ts src/lib tests/registrationRules.test.ts
git commit -m "feat(validation): shared registration rules returning error codes

Adds the checks that were missing: whatsapp digits, a real birth-date
check via isValidBirthDate, the letter cap client-side, graduation
year, and a distinct error per confirmation box instead of pushing
the checkbox label as the error text.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 6: The guardian rules

**Files:**
- Create: `convex/lib/guardianRules.ts`
- Create: `src/lib/guardianRules.ts`
- Create: `tests/guardianRules.test.ts`

**Interfaces:**
- Consumes: `FieldErrorCode` from `convex/lib/errorCodes.ts`; `isValidBirthDate`, `isUnderage` from `convex/lib/cycle.ts`; `isValidEmail` from `convex/lib/html.ts`.
- Produces:
  - `type GuardianFieldPath = 'birthDate' | 'guardianName' | 'guardianEmail'`
  - `type GuardianError = { field: GuardianFieldPath; code: FieldErrorCode }`
  - `type BirthDateDeclaration = { birthDate: string; guardianName?: string; guardianEmail?: string; ownEmail?: string }`
  - `validateBirthDateDeclaration(input, now?): GuardianError[]`
  - `checkGuardianName(v)`, `checkGuardianEmail(v, ownEmail?)`
  - `GUARDIAN_NAME_LIMIT`

This is where the check that never existed lands. `gate_guardian_email_same`
has been a translated message on both locales for the whole life of the
project and nothing ever called it: a minor can currently enter their own
address as their guardian's and authorize their own account.

- [ ] **Step 1: Write the failing test**

Create `tests/guardianRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  GUARDIAN_NAME_LIMIT,
  checkGuardianEmail,
  checkGuardianName,
  validateBirthDateDeclaration,
} from '../convex/lib/guardianRules'

/** 2026-08-27. A 2008 birth date is an adult, a 2012 one is a minor. */
const NOW = Date.parse('2026-08-27T12:00:00.000Z')
const ADULT = '2005-04-11'
const MINOR = '2012-04-11'

describe('validateBirthDateDeclaration', () => {
  it('accepts an adult with no guardian details', () => {
    expect(validateBirthDateDeclaration({ birthDate: ADULT }, NOW)).toEqual([])
  })

  it('ignores guardian details for an adult', () => {
    const errors = validateBirthDateDeclaration(
      { birthDate: ADULT, guardianName: '', guardianEmail: 'nope' },
      NOW,
    )
    expect(errors).toEqual([])
  })

  it('requires guardian details for a minor', () => {
    const errors = validateBirthDateDeclaration({ birthDate: MINOR }, NOW)
    expect(errors.map((e) => e.code)).toEqual([
      'guardian_name_required',
      'guardian_email_invalid',
    ])
  })

  it('accepts a minor with valid guardian details', () => {
    const errors = validateBirthDateDeclaration(
      { birthDate: MINOR, guardianName: 'Rosa Gómez', guardianEmail: 'rosa@example.com' },
      NOW,
    )
    expect(errors).toEqual([])
  })

  it('rejects a missing birth date', () => {
    expect(validateBirthDateDeclaration({ birthDate: '' }, NOW)[0].code).toBe(
      'birth_date_required',
    )
  })

  it('rejects a future birth date', () => {
    expect(validateBirthDateDeclaration({ birthDate: '2030-01-01' }, NOW)[0].code).toBe(
      'birth_date_future',
    )
  })

  /**
   * The hole this whole module exists to close. Without it a minor puts their
   * own address in as their guardian's and authorizes themselves, which is
   * exactly what the age gate is there to prevent.
   */
  it("rejects a guardian email equal to the registrant's own", () => {
    const errors = validateBirthDateDeclaration(
      {
        birthDate: MINOR,
        guardianName: 'Rosa Gómez',
        guardianEmail: 'ANA@example.com',
        ownEmail: 'ana@Example.com  ',
      },
      NOW,
    )
    expect(errors).toEqual([
      { field: 'guardianEmail', code: 'guardian_email_same_as_own' },
    ])
  })

  it('rejects an over-long guardian name', () => {
    const errors = validateBirthDateDeclaration(
      {
        birthDate: MINOR,
        guardianName: 'R'.repeat(GUARDIAN_NAME_LIMIT + 1),
        guardianEmail: 'rosa@example.com',
      },
      NOW,
    )
    expect(errors[0].code).toBe('guardian_name_too_long')
  })
})

describe('checkGuardianName', () => {
  it.each([
    ['Rosa Gómez', undefined],
    ['', 'guardian_name_required'],
    ['   ', 'guardian_name_required'],
  ])('%s -> %s', (input, expected) => {
    expect(checkGuardianName(input)).toBe(expected)
  })
})

describe('checkGuardianEmail', () => {
  it.each([
    ['rosa@example.com', undefined, undefined],
    ['', undefined, 'guardian_email_invalid'],
    ['rosa@', undefined, 'guardian_email_invalid'],
    ['ana@example.com', 'ana@example.com', 'guardian_email_same_as_own'],
    ['  ANA@EXAMPLE.COM ', 'ana@example.com', 'guardian_email_same_as_own'],
  ])('%s (own %s) -> %s', (input, own, expected) => {
    expect(checkGuardianEmail(input, own)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/guardianRules.test.ts`
Expected: FAIL — cannot resolve `../convex/lib/guardianRules`.

- [ ] **Step 3: Write the rules module**

Create `convex/lib/guardianRules.ts`:

```ts
import type { FieldErrorCode } from './errorCodes'
import { isUnderage } from './cycle'
import { isValidEmail } from './html'
import { checkBirthDate } from './registrationRules'

/**
 * Rules for declaring a birth date and, if that makes you a minor, your
 * guardian's details.
 *
 * Used by three callers that had three different answers: the age gate
 * (`/empezar`) hand-rolled its own date check, the recovery screen in
 * `/mi-registro` had none at all, and the server had a third. They now share
 * this.
 */

export const GUARDIAN_NAME_LIMIT = 120

export type GuardianFieldPath = 'birthDate' | 'guardianName' | 'guardianEmail'

export type GuardianError = {
  field: GuardianFieldPath
  code: FieldErrorCode
}

export type BirthDateDeclaration = {
  birthDate: string
  guardianName?: string
  guardianEmail?: string
  /**
   * The registrant's own address, when it is known. Supplying it turns on the
   * check that a guardian's email is not the registrant's own — the point of
   * asking a guardian at all.
   */
  ownEmail?: string
}

export function checkGuardianName(value: string | undefined): FieldErrorCode | undefined {
  const v = (value ?? '').trim()
  if (!v) return 'guardian_name_required'
  if (v.length > GUARDIAN_NAME_LIMIT) return 'guardian_name_too_long'
  return undefined
}

export function checkGuardianEmail(
  value: string | undefined,
  ownEmail?: string,
): FieldErrorCode | undefined {
  const v = (value ?? '').trim().toLowerCase()
  if (!isValidEmail(v)) return 'guardian_email_invalid'
  const own = (ownEmail ?? '').trim().toLowerCase()
  if (own && v === own) return 'guardian_email_same_as_own'
  return undefined
}

export function validateBirthDateDeclaration(
  input: BirthDateDeclaration,
  now: number = Date.now(),
): GuardianError[] {
  const errors: GuardianError[] = []

  const dateCode = checkBirthDate(input.birthDate, now)
  if (dateCode) {
    // No point asking about a guardian when we cannot tell whether one is
    // needed.
    return [{ field: 'birthDate', code: dateCode }]
  }

  if (!isUnderage(input.birthDate, now)) return errors

  const nameCode = checkGuardianName(input.guardianName)
  if (nameCode) errors.push({ field: 'guardianName', code: nameCode })

  const emailCode = checkGuardianEmail(input.guardianEmail, input.ownEmail)
  if (emailCode) errors.push({ field: 'guardianEmail', code: emailCode })

  return errors
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/guardianRules.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Write the client shim `src/lib/guardianRules.ts`**

```ts
/**
 * Re-exports the guardian rules from the backend.
 *
 * See `convex/lib/guardianRules.ts`.
 */
export {
  GUARDIAN_NAME_LIMIT,
  checkGuardianName,
  checkGuardianEmail,
  validateBirthDateDeclaration,
} from '../../convex/lib/guardianRules'

export type {
  BirthDateDeclaration,
  GuardianError,
  GuardianFieldPath,
} from '../../convex/lib/guardianRules'
```

- [ ] **Step 6: Commit**

```bash
git add convex/lib/guardianRules.ts src/lib/guardianRules.ts tests/guardianRules.test.ts
git commit -m "feat(validation): guardian rules, including the same-email check

gate_guardian_email_same has been a translated message since the
project started and nothing ever called it. A minor could enter their
own address as their guardian's and authorize their own account.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 7: Message keys and the code-to-prose map

**Files:**
- Modify: `messages/es.json`
- Modify: `messages/en.json`
- Create: `src/lib/registrationErrors.ts`

**Interfaces:**
- Consumes: `AppErrorCode`, `FieldErrorCode`, `ActionErrorCode` from `convex/lib/errorCodes.ts`.
- Produces:
  - `errorMessage(code: AppErrorCode): string` — the translated sentence for a code.
  - `errorCodeFromConvex(err: unknown): AppErrorCode | undefined` — unwraps a `ConvexError` payload.
  - `describeConvexError(err: unknown): string` — `errorMessage` of the above, falling back to a generic sentence.

Seventeen codes reuse messages that already exist. The rest are new and must be
added to **both** locale files, in the same key order, or the Paraglide errors
from the previous session come back.

- [ ] **Step 1: Add the new keys to `messages/es.json`**

Insert these, keeping them grouped near their siblings (the confirmation ones
after `reg_ck_privacy_sub`, the `err_` ones at the end before `nf_title`):

```json
  "reg_name_too_short": "Escribe tu nombre completo.",
  "reg_graduation_error": "Revisa el año de graduación.",
  "reg_letter_too_short": "Tu carta es demasiado breve. Cuéntanos un poco más.",
  "reg_letter_too_long": "La carta excede el máximo de {limit} caracteres.",
  "reg_letter_counter": "{count} / {limit} caracteres",
  "reg_ck_rules_error": "Debes aceptar las bases de la convocatoria.",
  "reg_ck_scholarship_error": "Debes confirmar que entiendes cómo se otorga la beca.",
  "reg_ck_privacy_error": "Debes aceptar el aviso de privacidad.",
  "reg_progress": "{percent}% completado",
  "reg_errors_title": "Falta algo antes de enviar",
  "reg_remove_row": "Quitar fila {n}",
  "gate_guardian_name_too_long": "Ese nombre es demasiado largo.",
  "status_email_verified": "Correo verificado",
  "status_email_unverified": "Falta verificar correo",
  "status_guardian_ok": "Tutor autorizó",
  "status_guardian_missing": "Falta autorización del tutor",
  "status_submitted": "Registro enviado",
  "status_draft": "Borrador",
  "err_generic": "Algo salió mal. Vuelve a intentarlo.",
  "err_already_reviewed": "Tu registro ya fue revisado y no se puede editar.",
  "err_birth_date_missing": "Antes de enviar tu registro necesitamos tu fecha de nacimiento.",
  "err_birth_date_locked": "Tu fecha de nacimiento ya está registrada y no se puede cambiar.",
  "err_not_signed_in": "No hay sesión iniciada.",
  "err_admin_required": "Se requiere rol de administrador.",
  "err_guardian_not_required": "Esta cuenta no requiere autorización de tutor.",
  "err_guardian_already_confirmed": "La autorización ya fue confirmada.",
  "err_field_too_long": "Hay un campo con más de {limit} caracteres.",
  "err_too_many_rows": "No se pueden registrar más de {limit} renglones por sección.",
```

- [ ] **Step 2: Add the same keys to `messages/en.json`**

```json
  "reg_name_too_short": "Enter your full name.",
  "reg_graduation_error": "Check the graduation year.",
  "reg_letter_too_short": "Your letter is too brief. Tell us a little more.",
  "reg_letter_too_long": "The letter exceeds the {limit} character maximum.",
  "reg_letter_counter": "{count} / {limit} characters",
  "reg_ck_rules_error": "You must accept the terms of the call for applications.",
  "reg_ck_scholarship_error": "You must confirm that you understand how the scholarship is awarded.",
  "reg_ck_privacy_error": "You must accept the privacy notice.",
  "reg_progress": "{percent}% complete",
  "reg_errors_title": "Something is missing before you can submit",
  "reg_remove_row": "Remove row {n}",
  "gate_guardian_name_too_long": "That name is too long.",
  "status_email_verified": "Email verified",
  "status_email_unverified": "Email not verified",
  "status_guardian_ok": "Guardian authorized",
  "status_guardian_missing": "Guardian authorization missing",
  "status_submitted": "Registration submitted",
  "status_draft": "Draft",
  "err_generic": "Something went wrong. Please try again.",
  "err_already_reviewed": "Your registration has already been reviewed and can't be edited.",
  "err_birth_date_missing": "We need your date of birth before you can submit your registration.",
  "err_birth_date_locked": "Your date of birth is already on file and can't be changed.",
  "err_not_signed_in": "You are not signed in.",
  "err_admin_required": "Administrator role required.",
  "err_guardian_not_required": "This account does not require guardian authorization.",
  "err_guardian_already_confirmed": "The authorization has already been confirmed.",
  "err_field_too_long": "One of the fields is longer than {limit} characters.",
  "err_too_many_rows": "You can't register more than {limit} rows per section.",
```

- [ ] **Step 3: Compile and verify both locales agree**

```bash
npm run paraglide
node -e "
const en=require('./messages/en.json'), es=require('./messages/es.json');
const e=Object.keys(es), n=Object.keys(en);
const missing=e.filter(k=>!n.includes(k)), extra=n.filter(k=>!e.includes(k));
if(missing.length||extra.length){console.error({missing,extra});process.exit(1)}
console.log('parity ok:', e.length, 'keys');
"
```

Expected: `parity ok: 172 keys` and a clean Paraglide compile.

- [ ] **Step 4: Extract the draft limits the message map needs**

`FIELD_LIMIT` and `ROW_LIMIT` are module-private consts in
`convex/registrations.ts` today. The message map needs them. Create
`convex/lib/registrationLimits.ts`:

```ts
/**
 * Draft caps. Generous: they exist to bound the document, not to validate it.
 *
 * They live apart from `registrations.ts` because the client needs them to
 * render the message that says which cap was hit.
 */
export const FIELD_LIMIT = 500
export const ROW_LIMIT = 60
```

Then in `convex/registrations.ts`, delete the two local consts and import them:

```ts
import { FIELD_LIMIT, ROW_LIMIT } from './lib/registrationLimits'
```

- [ ] **Step 5: Write `src/lib/registrationErrors.ts`**

```ts
import { ConvexError } from 'convex/values'
import * as m from '../paraglide/messages.js'
import type { AppErrorCode } from '../../convex/lib/errorCodes'
import { LETTER_LIMIT } from './registrationSchema'
import { FIELD_LIMIT, ROW_LIMIT } from '../../convex/lib/registrationLimits'

/**
 * Turns an error code into a sentence in the reader's language.
 *
 * This is the only place prose meets a code, and it is client-side on
 * purpose: the server used to build Spanish sentences, so an English session
 * that failed validation got Spanish back.
 */

const MESSAGES: Record<AppErrorCode, () => string> = {
  // Fields — most of these messages already existed and are simply reused.
  name_required: m.reg_name_error,
  name_too_short: m.reg_name_too_short,
  email_invalid: m.reg_email_error,
  whatsapp_invalid: m.reg_whatsapp_error,
  birth_date_required: m.gate_date_error,
  birth_date_future: m.gate_date_future,
  birth_date_implausible: m.gate_date_implausible,
  branch_required: m.reg_branch_error,
  city_required: m.reg_city_error,
  school_required: m.reg_school_error,
  grade_required: m.reg_grade_error,
  graduation_year_invalid: m.reg_graduation_error,
  club_required: m.reg_club_error,
  coach_required: m.reg_coach_error,
  ghin_required: m.reg_ghin_error,
  results_required: m.reg_results_error,
  letter_required: m.reg_letter_error,
  letter_too_short: m.reg_letter_too_short,
  letter_too_long: () => m.reg_letter_too_long({ limit: LETTER_LIMIT }),
  confirm_rules_required: m.reg_ck_rules_error,
  confirm_scholarship_required: m.reg_ck_scholarship_error,
  confirm_privacy_required: m.reg_ck_privacy_error,
  guardian_name_required: m.gate_guardian_name_error,
  guardian_name_too_long: m.gate_guardian_name_too_long,
  guardian_email_invalid: m.gate_guardian_email_error,
  guardian_email_same_as_own: m.gate_guardian_email_same,

  // Actions.
  window_closed: m.reg_closed,
  already_reviewed: m.err_already_reviewed,
  birth_date_missing: m.err_birth_date_missing,
  birth_date_locked: m.err_birth_date_locked,
  not_signed_in: m.err_not_signed_in,
  admin_required: m.err_admin_required,
  guardian_not_required: m.err_guardian_not_required,
  guardian_already_confirmed: m.err_guardian_already_confirmed,
  field_too_long: () => m.err_field_too_long({ limit: FIELD_LIMIT }),
  too_many_rows: () => m.err_too_many_rows({ limit: ROW_LIMIT }),
  generic: m.err_generic,
}

export function errorMessage(code: AppErrorCode): string {
  return MESSAGES[code]()
}

/**
 * Digs the code out of whatever a Convex mutation threw.
 *
 * `ConvexError` carries a structured `data` payload across the wire; a plain
 * `Error` does not, and its message arrives wrapped in Convex's own framing.
 */
export function errorCodeFromConvex(err: unknown): AppErrorCode | undefined {
  if (!(err instanceof ConvexError)) return undefined
  const data = err.data as { code?: string } | undefined
  const code = data?.code
  if (typeof code !== 'string') return undefined
  return code in MESSAGES ? (code as AppErrorCode) : undefined
}

export function describeConvexError(err: unknown): string {
  const code = errorCodeFromConvex(err)
  return code ? errorMessage(code) : m.err_generic()
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS for the new files. Errors remaining in `RegistrationForm.tsx` and `mi-registro.tsx` are expected; Task 8 and Stage 3 clear them.

- [ ] **Step 7: Commit**

```bash
git add messages src/lib/registrationErrors.ts convex/lib/registrationLimits.ts convex/registrations.ts src/paraglide
git commit -m "feat(i18n): translate error codes client-side

Server rejections were hardcoded Spanish and reached an English UI.
Codes now cross the wire and the client renders them in the reader's
language. Also lifts the hardcoded UI strings (progress, error
heading, row removal, status chips) into message keys.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 8: Rewire the server to codes

**Files:**
- Modify: `convex/registrations.ts`
- Create: `tests/registrationServerContract.test.ts`

**Interfaces:**
- Consumes: `validateRegistration` from `convex/lib/registrationRules.ts`; `ActionErrorCode` from `convex/lib/errorCodes.ts`.
- Produces: `submit` returns `{ ok: false, errors: RegistrationError[] }` instead of `{ ok: false, errors: string[] }`. Task 10 updates the caller.

- [ ] **Step 1: Write the failing contract test**

Create `tests/registrationServerContract.test.ts`. This does not boot Convex; it
pins the property that matters — that the server's rule set is the shared one,
and that `branch` (checked on the client and *not* on the server today) is now
covered.

```ts
import { describe, expect, it } from 'vitest'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import { toErrorMap, validateRegistration } from '../convex/lib/registrationRules'
import type { RegistrationData } from '../convex/lib/registrationSchema'

describe('server validation contract', () => {
  it('rejects a branch the client would also reject', () => {
    const d: RegistrationData = emptyRegistration()
    d.personal.branch = '' as RegistrationData['personal']['branch']
    // Before this change the server accepted any branch: the check existed
    // only on the client, which is not a check.
    expect(toErrorMap(validateRegistration(d))['personal.branch']).toBe('branch_required')
  })

  it('never returns prose', () => {
    for (const e of validateRegistration(emptyRegistration())) {
      expect(e.code).toMatch(/^[a-z0-9_]+$/)
      expect(e.code).not.toContain(' ')
    }
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/registrationServerContract.test.ts`
Expected: PASS — the rules module from Task 5 already satisfies it. This test exists to keep it true.

- [ ] **Step 3: Replace the server's local `validate`**

In `convex/registrations.ts`, delete the whole `function validate(...)` block
(lines ~115–147) and its `LETTER_LIMIT` local const, then import the shared
pieces at the top:

```ts
import { ConvexError } from 'convex/values'
import { LETTER_LIMIT } from './lib/registrationSchema'
import { validateRegistration } from './lib/registrationRules'
import { FIELD_LIMIT, ROW_LIMIT } from './lib/registrationLimits'
import type { ActionErrorCode } from './lib/errorCodes'
```

- [ ] **Step 4: Convert the thrown errors to `ConvexError`**

Add a helper near the top of `convex/registrations.ts`:

```ts
/**
 * Errors cross the wire as codes so the browser can say them in the reader's
 * language. A plain `Error` message cannot: it arrives wrapped in Convex's
 * own framing and is whatever language the server happened to be written in.
 */
function fail(code: ActionErrorCode): never {
  throw new ConvexError({ code })
}
```

Then replace each throw:

| Line (before) | After |
|---|---|
| `throw new Error(\`La carta excede...\`)` | `fail('letter_too_long')` |
| `throw new Error(\`No se pueden registrar más de ${ROW_LIMIT}...\`)` | `fail('too_many_rows')` |
| `throw new Error(\`Hay un campo con más de ${FIELD_LIMIT}...\`)` | `fail('field_too_long')` |
| `throw new Error('El periodo de registro está cerrado...')` | `fail('window_closed')` |
| both `throw new Error('Tu registro ya fue revisado...')` | `fail('already_reviewed')` |

- [ ] **Step 5: Change `submit` to return codes**

In the `submit` handler, replace the birth-date backstop:

```ts
    if (user.birthDate === undefined) {
      return {
        ok: false as const,
        errors: [{ field: 'personal.birthDate' as const, code: 'birth_date_missing' as const }],
      }
    }

    const errors = validateRegistration(args.data)
    if (errors.length > 0) return { ok: false as const, errors }
```

and the success return:

```ts
    return { ok: true as const, errors: [] }
```

`birth_date_missing` is an `ActionErrorCode`, and this is the one place it is
returned rather than thrown so it can be shown next to the birth date field.
No widening is needed at the boundary: `RegistrationError['code']` is already
`AppErrorCode` (Task 5), which is exactly why it was typed that way.

- [ ] **Step 6: Typecheck and test**

Run: `npm run typecheck && npx vitest run --project unit`
Expected: `typecheck` still fails in `mi-registro.tsx` (its `handleSubmit` returns `string[]`); Task 10 fixes it. All unit tests PASS.

- [ ] **Step 7: Commit**

```bash
git add convex/registrations.ts tests/registrationServerContract.test.ts
git commit -m "refactor(convex): registrations validate via the shared rules

Adds the branch check, which existed only on the client and therefore
was not a check. Errors now cross the wire as codes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 9: Rewire the remaining mutations to codes

**Files:**
- Modify: `convex/users.ts`
- Modify: `convex/preSignups.ts`
- Modify: `convex/guardian.ts`

**Interfaces:**
- Consumes: `validateBirthDateDeclaration` from `convex/lib/guardianRules.ts`; `ActionErrorCode`, `FieldErrorCode` from `convex/lib/errorCodes.ts`.
- Produces: every mutation throws `ConvexError({ code })`. Task 10 reads them.

- [ ] **Step 1: Add the `fail` helper to each file**

At the top of `convex/users.ts`, `convex/preSignups.ts` and `convex/guardian.ts`:

```ts
import { ConvexError } from 'convex/values'
import type { AppErrorCode } from './lib/errorCodes'

function fail(code: AppErrorCode): never {
  throw new ConvexError({ code })
}
```

- [ ] **Step 2: Convert `convex/users.ts`**

| Before | After |
|---|---|
| `throw new Error('No hay sesión iniciada.')` | `fail('not_signed_in')` |
| `throw new Error('Se requiere rol de administrador.')` | `fail('admin_required')` |
| `throw new Error('Tu fecha de nacimiento ya está registrada...')` | `fail('birth_date_locked')` |

Then add the import:

```ts
import { validateBirthDateDeclaration } from './lib/guardianRules'
```

and replace the hand-rolled block inside `declareBirthDate` (the
`isValidBirthDate` / `isUnderage` / guardian checks, lines ~253–268) with the
shared rule:

```ts
    const now = Date.now()
    const birthDate = args.birthDate.trim()
    const guardianName = args.guardianName?.trim()
    const guardianEmail = args.guardianEmail?.trim().toLowerCase()

    const problems = validateBirthDateDeclaration(
      { birthDate, guardianName, guardianEmail, ownEmail: user.email },
      now,
    )
    if (problems.length > 0) fail(problems[0].code)

    const isMinor = isUnderage(birthDate, now)
```

Passing `user.email` is what finally enables the same-email check on this path:
the account's verified address is known here, so a minor naming themselves as
their own guardian is now rejected server-side.

- [ ] **Step 3: Convert `convex/preSignups.ts`**

Add `import { validateBirthDateDeclaration } from './lib/guardianRules'`, then
replace the checks in `create` (lines ~35–52) with the shared rule. There is no
account yet, so there is no own-email to compare against — the check simply does
not apply on this path, and `ownEmail` is left undefined:

```ts
    const problems = validateBirthDateDeclaration(
      { birthDate, guardianName, guardianEmail },
      now,
    )
    if (problems.length > 0) fail(problems[0].code)

    // THE decision. It is made here and nowhere else.
    const isMinor = isUnderage(birthDate, now)
```

- [ ] **Step 4: Convert `convex/guardian.ts`**

| Before | After |
|---|---|
| both `throw new Error('Esta cuenta no requiere autorización de tutor.')` | `fail('guardian_not_required')` |
| `throw new Error('La autorización ya fue confirmada.')` | `fail('guardian_already_confirmed')` |
| `throw new Error('Escribe el nombre de tu tutor.')` | `fail('guardian_name_required')` |
| `throw new Error('El nombre es demasiado largo.')` | `fail('guardian_name_too_long')` |
| `throw new Error('Escribe un correo válido para tu tutor.')` | `fail('guardian_email_invalid')` |

- [ ] **Step 5: Verify no prose throws remain**

```bash
grep -rn "throw new Error(" convex/*.ts convex/lib/*.ts
```

Expected: no output.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: only the `mi-registro.tsx` / `empezar.tsx` caller errors remain.

- [ ] **Step 7: Commit**

```bash
git add convex/users.ts convex/preSignups.ts convex/guardian.ts
git commit -m "refactor(convex): throw ConvexError codes instead of Spanish prose

declareBirthDate now passes the account email into the guardian rule,
so a minor naming themselves as their own guardian is rejected on the
server too.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 10: Client call sites read the codes

**Files:**
- Modify: `src/routes/mi-registro.tsx`
- Modify: `src/routes/empezar.tsx`
- Modify: `src/components/RegistrationForm.tsx`

**Interfaces:**
- Consumes: `describeConvexError`, `errorMessage` from `src/lib/registrationErrors.ts`; `RegistrationError` from `src/lib/registrationRules.ts`.
- Produces: a green `npm run typecheck`. Stage 3 splits these same files.

This task exists to close Stage 2 with a working app. Stage 3 and 4 then
restructure the files it touches.

- [ ] **Step 1: Update `handleSubmit` in `mi-registro.tsx`**

```ts
  const handleSubmit = useCallback(
    async (d: RegistrationData): Promise<RegistrationError[]> => {
      try {
        const r = await submitRegistration({ data: prepareForSubmit(d) })
        return r.ok ? [] : r.errors
      } catch (err) {
        // A thrown error is about the action, not a field: the window closed,
        // the registration was already reviewed. Surface it as a form-level
        // problem rather than losing it.
        return [{ field: 'form', code: errorCodeFromConvex(err) ?? 'generic' }]
      }
    },
    [submitRegistration],
  )
```

`'form'` and `'generic'` already exist — `'form'` in `RegistrationFieldPath`
(Task 5) and `'generic'` in `ActionErrorCode` (Task 4). Add the imports this
file now needs:

```ts
import { errorCodeFromConvex, errorMessage } from '../lib/registrationErrors'
import { validateRegistration } from '../lib/registrationRules'
import type { RegistrationError } from '../lib/registrationRules'
```

- [ ] **Step 2: Update `RegistrationForm`'s prop type and error rendering**

Change the `Props` type:

```ts
  onSubmit: (data: RegistrationData) => Promise<RegistrationError[]>
```

and the state:

```ts
  const [errors, setErrors] = useState<RegistrationError[]>([])
```

and the list rendering, which is the only place codes become sentences:

```tsx
            {errors.map((e) => (
              <li key={`${e.field}:${e.code}`}>{errorMessage(e.code)}</li>
            ))}
```

and the local submit check:

```ts
    const localErrors = validateRegistration(data)
```

- [ ] **Step 3: Update `empezar.tsx`'s catch block**

```ts
    } catch (err) {
      setErrors({ birthDate: describeConvexError(err) })
      setSubmitting(false)
    }
```

- [ ] **Step 4: Verify the whole check**

Run: `npm run typecheck && npm test`
Expected: PASS both. `npm run lint` still fails on `no-multi-comp` — Stage 3.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(i18n): render server error codes in the reader's language

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

# STAGE 3 — One component per file

Stage 3 moves code without changing behaviour. `npm test` must stay green at
every step; the deliverable is a green `npm run lint`.

### Task 11: Extract the field components

**Files:**
- Create: `src/components/FieldError.tsx`
- Create: `src/components/TextField.tsx`
- Create: `src/components/SelectField.tsx`
- Create: `src/components/CheckboxField.tsx`
- Create: `src/components/FieldGrid.tsx`
- Create: `src/components/DynamicRows.tsx`
- Modify: `src/components/RegistrationForm.tsx`

**Interfaces:**
- Consumes: `errorMessage` from `src/lib/registrationErrors.ts`; `FieldErrorCode` from `convex/lib/errorCodes.ts`; `Row`, `emptyRow` from `src/lib/registrationSchema.ts`.
- Produces, all default exports:
  - `FieldError({ id, code })`
  - `TextField({ id, label, req, help, type, value, onChange, onBlur, error, autoComplete })`
  - `SelectField({ id, label, req, help, value, onChange, onBlur, error, options })`
  - `CheckboxField({ id, title, sub, checked, onChange, error, doc })`
  - `FieldGrid({ children })`
  - `DynamicRows({ rows, phA, phB, addLabel, onChange })`

Every field component gains an optional `error?: FieldErrorCode`. Nothing passes
it yet — Stage 4 does. Adding the prop now means Stage 4 is a wiring change, not
another rewrite of these files.

- [ ] **Step 1: Write `src/components/FieldError.tsx`**

```tsx
import type { FieldErrorCode } from '../../convex/lib/errorCodes'
import { errorMessage } from '../lib/registrationErrors'

/**
 * One field's error. It owns the `id` that the input's `aria-describedby`
 * points at, so a screen reader announces the problem with the field rather
 * than leaving it in a banner the user has to go find.
 */
export default function FieldError({ id, code }: { id: string; code?: FieldErrorCode }) {
  if (!code) return null
  return (
    <p id={id} role="alert" className="text-[11.5px] text-bad">
      {errorMessage(code)}
    </p>
  )
}
```

- [ ] **Step 2: Write `src/components/TextField.tsx`**

Move the body of `Field` verbatim, then add the error wiring:

```tsx
import type { FieldErrorCode } from '../../convex/lib/errorCodes'
import FieldError from './FieldError'

export default function TextField({
  id,
  label,
  req,
  help,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
}: {
  id: string
  label: string
  req?: boolean
  help?: string
  type?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: FieldErrorCode
  autoComplete?: string
}) {
  const errorId = `${id}-error`
  const helpId = `${id}-help`
  return (
    <div className="mb-[15px] flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`fld-input ${error ? 'border-bad' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errorId : null, help ? helpId : null]
          .filter(Boolean)
          .join(' ') || undefined}
      />
      {help && (
        <p id={helpId} className="text-[11.5px] text-soft">
          {help}
        </p>
      )}
      <FieldError id={errorId} code={error} />
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/SelectField.tsx`**

Same treatment for `Select`: identical markup, plus `onBlur`, `error`,
`aria-invalid`, `aria-describedby`, and a `<FieldError>` at the end. Keep the
`options: Array<{ v: string; t: string }>` prop shape unchanged.

- [ ] **Step 4: Write `src/components/CheckboxField.tsx`**

Move `Checkbox` verbatim — including the comment explaining why the document
link stops propagation — and add `error?: FieldErrorCode` plus a `<FieldError>`
after the `<span>`.

- [ ] **Step 5: Write `src/components/FieldGrid.tsx`**

```tsx
export default function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-[15px] sm:grid-cols-2">{children}</div>
}
```

- [ ] **Step 6: Write `src/components/DynamicRows.tsx`**

Move `DynamicRows` verbatim, keeping its doc comment. Replace the hardcoded
`aria-label={\`Quitar fila ${i + 1}\`}` with the message key added in Task 7:

```tsx
            aria-label={m.reg_remove_row({ n: i + 1 })}
```

- [ ] **Step 7: Delete the moved components from `RegistrationForm.tsx` and import them**

```tsx
import TextField from './TextField'
import SelectField from './SelectField'
import CheckboxField from './CheckboxField'
import FieldGrid from './FieldGrid'
import DynamicRows from './DynamicRows'
```

Rename the JSX usages: `<Field` → `<TextField`, `<Select` → `<SelectField`,
`<Checkbox` → `<CheckboxField`, `<Grid` → `<FieldGrid`.

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npm test && npx eslint src/components`
Expected: typecheck and tests PASS. ESLint on `src/components` reports
`no-multi-comp` only for `RegistrationForm.tsx` (still holds `Section` and
`computeProgress`); the six new files are clean.

- [ ] **Step 9: Commit**

```bash
git add src/components
git commit -m "refactor(components): one file per field component

Each gains an optional error prop with aria-invalid and
aria-describedby wiring. Nothing passes it yet; stage 4 does.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 12: Extract the form chrome

**Files:**
- Create: `src/components/FormSection.tsx`
- Create: `src/components/ProgressBar.tsx`
- Create: `src/components/ErrorSummary.tsx`
- Create: `src/lib/registrationProgress.ts`
- Create: `tests/registrationProgress.test.ts`
- Modify: `src/components/RegistrationForm.tsx`

**Interfaces:**
- Consumes: `RegistrationError` from `src/lib/registrationRules.ts`; `errorMessage` from `src/lib/registrationErrors.ts`.
- Produces:
  - `computeProgress(d: RegistrationData): number` from `src/lib/registrationProgress.ts`
  - `FormSection({ n, title, sub, children })`
  - `ProgressBar({ percent })`
  - `ErrorSummary({ errors })`

- [ ] **Step 1: Write the failing progress test**

Create `tests/registrationProgress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import { computeProgress } from '../src/lib/registrationProgress'

describe('computeProgress', () => {
  it('is 0 for an untouched registration', () => {
    expect(computeProgress(emptyRegistration())).toBe(0)
  })

  it('counts a filled field', () => {
    const d = emptyRegistration({ name: 'Ana Gómez' })
    expect(computeProgress(d)).toBeGreaterThan(0)
  })

  it('is 100 when every tracked field is filled', () => {
    const d = emptyRegistration({
      name: 'Ana',
      email: 'a@b.co',
      whatsapp: '5512345678',
      birthDate: '2008-04-11',
      branch: 'womens',
      cityState: 'MTY',
    })
    d.academic = { school: 'X', grade: '11', graduationYear: '', interest: '' }
    d.athletic = { club: 'C', coach: 'K', ghin: '4', amateurStatus: true }
    d.results = [{ tournament: 'CNIJ', result: '2' }]
    d.motivationLetter = 'porque sí'
    d.confirmations = { rules: true, scholarshipUnderstood: true, privacy: true }
    expect(computeProgress(d)).toBe(100)
  })

  it('does not count a half-filled result row', () => {
    const d = emptyRegistration()
    d.results = [{ tournament: 'CNIJ', result: '' }]
    expect(computeProgress(d)).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/registrationProgress.test.ts`
Expected: FAIL — cannot resolve `../src/lib/registrationProgress`.

- [ ] **Step 3: Move `computeProgress` into `src/lib/registrationProgress.ts`**

Cut the function out of `RegistrationForm.tsx` verbatim, keeping its doc comment
("Approximate progress, only for the bar. It is not the validation."), and add
the imports it needs:

```ts
import type { RegistrationData } from './registrationSchema'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/registrationProgress.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write `src/components/FormSection.tsx`**

Move `Section` verbatim, renamed to `FormSection`.

- [ ] **Step 6: Write `src/components/ProgressBar.tsx`**

```tsx
import * as m from '../paraglide/messages.js'

/** The sticky progress bar, as in the prototype. */
export default function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="sticky top-0 z-40 -mx-[22px] mb-8 border-b border-line bg-paper/95 px-[22px] py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="eyebrow whitespace-nowrap">{m.reg_progress({ percent })}</span>
        <div
          className="h-[3px] flex-1 overflow-hidden rounded-sm bg-line"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i
            className="block h-full bg-yel transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Write `src/components/ErrorSummary.tsx`**

```tsx
import * as m from '../paraglide/messages.js'
import { errorMessage } from '../lib/registrationErrors'
import type { RegistrationError } from '../lib/registrationRules'

/**
 * The list at the top of the form.
 *
 * It stays, because on an eight-section form a summary is how you learn how
 * much is wrong at once. What changed is that each entry now links to its
 * field instead of describing it and leaving you to hunt.
 */
export default function ErrorSummary({ errors }: { errors: RegistrationError[] }) {
  if (errors.length === 0) return null
  return (
    <div
      id="errors"
      role="alert"
      tabIndex={-1}
      className="mb-8 rounded-[9px] border border-bad/40 bg-bad/5 px-5 py-4"
    >
      <b className="mb-2 block font-disp text-[14.5px] text-bad">{m.reg_errors_title()}</b>
      <ul className="m-0 list-disc pl-5 text-[13px] text-ink-3">
        {errors.map((e) => (
          <li key={`${e.field}:${e.code}`}>
            {/*
              `form` is not a field and has no element to jump to, so it gets
              no link — a link that goes nowhere is worse than plain text.
            */}
            {e.field === 'form' ? (
              errorMessage(e.code)
            ) : (
              <a href={`#${e.field}`} className="underline">
                {errorMessage(e.code)}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

The anchor targets require each input's `id` to equal its field path. Change the
`id` props in `RegistrationForm.tsx` accordingly: `id="name"` → `id="personal.name"`,
`id="mail"` → `id="personal.email"`, `id="tel"` → `id="personal.whatsapp"`,
`id="birth"` → `id="personal.birthDate"`, `id="branch"` → `id="personal.branch"`,
`id="city"` → `id="personal.cityState"`, `id="school"` → `id="academic.school"`,
`id="grade"` → `id="academic.grade"`, `id="grad"` → `id="academic.graduationYear"`,
`id="interest"` → `id="academic.interest"`, `id="club"` → `id="athletic.club"`,
`id="coach"` → `id="athletic.coach"`, `id="status"` → `id="athletic.amateurStatus"`,
`id="ghin"` → `id="athletic.ghin"`, `id="letter"` → `id="motivationLetter"`,
`id="ck1"` → `id="confirmations.rules"`, `id="ck2"` →
`id="confirmations.scholarshipUnderstood"`, `id="ck3"` → `id="confirmations.privacy"`.

- [ ] **Step 8: Use the three in `RegistrationForm.tsx`**

Replace the inline progress bar markup with `<ProgressBar percent={progress} />`,
the inline error block with `<ErrorSummary errors={errors} />`, and rename every
`<Section` to `<FormSection`. Replace the hardcoded letter counter with the
message key:

```tsx
        <p className={...}>
          {m.reg_letter_counter({
            count: data.motivationLetter.length,
            limit: LETTER_LIMIT,
          })}
        </p>
```

- [ ] **Step 9: Verify**

Run: `npm run typecheck && npm test && npx eslint src/components`
Expected: all PASS, including ESLint — `RegistrationForm.tsx` now holds one component.

- [ ] **Step 10: Commit**

```bash
git add src/components src/lib/registrationProgress.ts tests/registrationProgress.test.ts
git commit -m "refactor(components): split the form chrome out of RegistrationForm

619 lines and seven components down to one. Error summary entries now
link to their field, which needs the input ids to be the field paths.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 13: Split the registration route

**Files:**
- Create: `src/components/PageFrame.tsx`
- Create: `src/components/AccountStatus.tsx`
- Create: `src/components/GuardianNotice.tsx`
- Create: `src/components/SyncingFrame.tsx`
- Create: `src/components/RegistrationPanel.tsx`
- Modify: `src/routes/mi-registro.tsx`
- Modify: `src/routes/autorizar.$token.tsx`

**Interfaces:**
- Consumes: everything from Tasks 11–12.
- Produces: `mi-registro.tsx` holds only `MyRegistration`; `autorizar.$token.tsx` holds only `Authorize`.

- [ ] **Step 1: Write `src/components/PageFrame.tsx`**

`mi-registro.tsx` and `autorizar.$token.tsx` each define a `Frame`. They differ
only in that one takes an optional title. One component covers both:

```tsx
/**
 * The narrow single-column page shell.
 *
 * There used to be two of these, called `Frame`, in two different files, each
 * unaware of the other. Same markup, one optional heading apart.
 */
export default function PageFrame({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      {title && <h1 className="h-display text-[clamp(24px,4vw,32px)]">{title}</h1>}
      {children}
    </main>
  )
}
```

- [ ] **Step 2: Move `AccountStatus` into its own file**

Move it verbatim, keeping its doc comment, and replace the six hardcoded Spanish
chip labels with the keys from Task 7:

```tsx
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
```

- [ ] **Step 3: Move `GuardianNotice` and `SyncingFrame` into their own files**

Verbatim, keeping their doc comments. `SyncingFrame` uses `PageFrame` for its shell.

- [ ] **Step 4: Move `Panel` into `src/components/RegistrationPanel.tsx`**

Rename `Panel` → `RegistrationPanel`, keeping the `handleSaveDraft` /
`handleSubmit` `useCallback`s **and the comment explaining why they are stable** —
that comment describes the same autosave loop Stage 4 has to preserve.

Replace its `<Frame>` usages with `<PageFrame>`.

- [ ] **Step 5: Reduce `mi-registro.tsx` to one component**

It keeps `Route`, `MyRegistration`, and its imports. `BirthDateStep` stays for
now; Task 14 removes it.

- [ ] **Step 6: Point `autorizar.$token.tsx` at `PageFrame`**

Delete its local `Frame` and import `PageFrame` instead.

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm test && npm run lint`
Expected: typecheck and tests PASS. Lint reports `no-multi-comp` only for
`mi-registro.tsx` (`MyRegistration` + `BirthDateStep`).

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "refactor(routes): split mi-registro and autorizar

Two rival Frame components become one PageFrame. Status chips move
into message keys.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 14: Merge the two birth-date forms

**Files:**
- Create: `src/components/BirthDateForm.tsx`
- Modify: `src/routes/empezar.tsx`
- Modify: `src/routes/mi-registro.tsx`

**Interfaces:**
- Consumes: `validateBirthDateDeclaration` from `src/lib/guardianRules.ts`; `isUnderage` from `src/lib/preSignup.ts`; `describeConvexError` from `src/lib/registrationErrors.ts`.
- Produces: `BirthDateForm({ lede, submitLabel, ownEmail, onSubmit })` where
  `onSubmit: (v: { birthDate: string; guardianName?: string; guardianEmail?: string }) => Promise<void>`.

`AgeGate` and `BirthDateStep` collect the same three fields. One validates by
hand with `new Date()`; the other does not validate at all. They become one
component with the shared rule, differing only in their lede copy and their
mutation.

- [ ] **Step 1: Write `src/components/BirthDateForm.tsx`**

Take the markup from `AgeGate` (it is the more complete of the two: it has the
minor notice, the guardian help text and the error rendering), parameterise the
lede and the submit label, and replace the hand-rolled `validate()` with the
shared rule:

```tsx
import { useState } from 'react'
import * as m from '../paraglide/messages.js'
import { isUnderage } from '../lib/preSignup'
import { validateBirthDateDeclaration } from '../lib/guardianRules'
import type { GuardianFieldPath } from '../lib/guardianRules'
import { describeConvexError, errorMessage } from '../lib/registrationErrors'
import type { FieldErrorCode } from '../../convex/lib/errorCodes'
import TextField from './TextField'

type Values = { birthDate: string; guardianName?: string; guardianEmail?: string }

/**
 * Birth date, plus the guardian's details when the date makes you a minor.
 *
 * Used by the age gate (`/empezar`, before the account exists) and by the
 * recovery screen in `/mi-registro` (when an account somehow arrived without
 * a date). They used to be two copies with two different ideas of what a
 * valid date was — and the recovery one had no validation at all.
 *
 * `isUnderage` here only reveals the guardian fields while the date is being
 * typed. The server decides, and re-runs the same rule.
 */
export default function BirthDateForm({
  lede,
  submitLabel,
  ownEmail,
  onSubmit,
}: {
  lede: string
  submitLabel: string
  /** Enables the "your guardian's email cannot be your own" check. */
  ownEmail?: string
  onSubmit: (values: Values) => Promise<void>
}) {
  const [birthDate, setBirthDate] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [errors, setErrors] = useState<Partial<Record<GuardianFieldPath, FieldErrorCode>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isMinor = birthDate ? isUnderage(birthDate) : false

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setFormError(null)

    const problems = validateBirthDateDeclaration(
      { birthDate, guardianName, guardianEmail, ownEmail },
    )
    if (problems.length > 0) {
      const map: Partial<Record<GuardianFieldPath, FieldErrorCode>> = {}
      for (const p of problems) map[p.field] ??= p.code
      setErrors(map)
      return
    }
    setErrors({})

    setSubmitting(true)
    try {
      await onSubmit({
        birthDate,
        guardianName: isMinor ? guardianName.trim() : undefined,
        guardianEmail: isMinor ? guardianEmail.trim().toLowerCase() : undefined,
      })
    } catch (err) {
      // The server revalidates everything and can know things the client
      // cannot. Its answer wins.
      setFormError(describeConvexError(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8">
      <p className="mt-3 max-w-[52ch] font-light text-soft">{lede}</p>

      <TextField
        id="birthDate"
        type="date"
        label={m.gate_date_label()}
        req
        value={birthDate}
        onChange={setBirthDate}
        error={errors.birthDate}
        autoComplete="bday"
      />

      {isMinor && (
        <section className="nota mb-5">
          <b className="mb-1.5 block font-disp text-[14.5px]">{m.gate_minor_title()}</b>
          <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
            {m.gate_minor_text()}
          </p>
          <TextField
            id="guardianName"
            label={m.gate_guardian_name()}
            req
            value={guardianName}
            onChange={setGuardianName}
            error={errors.guardianName}
          />
          <TextField
            id="guardianEmail"
            type="email"
            label={m.gate_guardian_email()}
            req
            help={m.gate_guardian_help()}
            value={guardianEmail}
            onChange={setGuardianEmail}
            error={errors.guardianEmail}
          />
        </section>
      )}

      {formError && <p className="mb-3 text-[12.5px] text-bad">{formError}</p>}

      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? m.common_loading() : submitLabel}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Rewrite `AgeGate` in `empezar.tsx` to use it**

```tsx
function AgeGate() {
  const navigate = useNavigate()
  const createPreSignup = useMutation(api.preSignups.create)

  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.gate_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.gate_title()}</h1>
      <BirthDateForm
        lede={m.gate_lede()}
        submitLabel={m.common_continue()}
        onSubmit={async (v) => {
          const { token } = await createPreSignup(v)
          savePreSignupToken(token)
          await navigate({ to: '/crear-cuenta' })
        }}
      />
    </main>
  )
}
```

Keep the long doc comment above `AgeGate` — it explains why the gate runs
before the Clerk sign-up, which is the least obvious decision in the file.

- [ ] **Step 3: Replace `BirthDateStep` in `mi-registro.tsx`**

Delete the whole `BirthDateStep` function. In `RegistrationPanel`, replace
`<BirthDateStep />` with:

```tsx
    return (
      <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
        <p className="eyebrow">{m.gate_eyebrow()}</p>
        <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.gate_title()}</h1>
        <BirthDateForm
          lede={m.age_missing_text()}
          submitLabel={m.common_continue()}
          ownEmail={user?.primaryEmailAddress?.emailAddress}
          onSubmit={async (v) => {
            await declareBirthDate(v)
            // No navigation needed: `myStatus` is reactive and this screen
            // replaces itself with the form as soon as the mutation confirms.
          }}
        />
      </main>
    )
```

Add `const declareBirthDate = useMutation(api.users.declareBirthDate)` to
`RegistrationPanel`.

Passing `ownEmail` here is what makes the same-email check visible in the
browser; the server enforces it either way as of Task 9.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run lint`
Expected: **all three PASS.** This is the first green `npm run check` of the branch.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "refactor(components): one BirthDateForm for both entry points

The age gate and the recovery screen collected the same three fields
with different rules; the recovery screen had none. Both now use the
shared guardian rule, and the recovery screen passes the account email
so the same-email check applies there.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 15: Lock the stage in

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: a green `npm run check`.
- Produces: the convention written down where a new contributor will find it.

- [ ] **Step 1: Confirm the whole check is green**

Run: `npm run check`
Expected: PASS — lint, typecheck, and all tests.

- [ ] **Step 2: Confirm no file holds two components**

```bash
npx eslint . --rule '{"react/no-multi-comp":"error"}' 2>&1 | tail -5
```

Expected: no `no-multi-comp` findings.

- [ ] **Step 3: Document the convention in `README.md`**

Add, under the existing stack description:

```markdown
## Conventions

- **One component per file**, named after the component. Enforced by
  `react/no-multi-comp` and the local `component-filename-match` rule; run
  `npm run lint`. Route files are exempt from the filename half — TanStack
  Router names them by URL.
- **Validation lives in `convex/lib/`** and is re-exported by `src/lib/`, the
  same way `cycle.ts` is. Rules return error *codes*; only the client turns a
  code into a sentence, so a server rejection is readable in either language.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: write down the one-component-per-file convention

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

# STAGE 4 — TanStack Form

### Task 16: The autosave loop, as a testable unit

**Files:**
- Create: `src/lib/draftAutosave.ts`
- Create: `src/hooks/useDraftAutosave.ts`
- Create: `tests/draftAutosave.test.ts`
- Create: `tests/components/useDraftAutosave.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `fingerprint(value: unknown): string`
  - `shouldSaveDraft(next: string, lastSaved: string): boolean`
  - `useDraftAutosave<T>({ values, initial, enabled, delayMs, onSave }): void`

This task comes **before** the form is rewired, on purpose. The
`lastSaved` comparison in the current `useEffect` is not an optimization —
the existing comment says so plainly: without it, "every open tab wrote to
Convex every 1.2 s forever, even if nobody was typing." Saving bumps
`updatedAt`, which invalidates the reactive query feeding the screen, which
re-renders the parent, which refires the effect. Pin that behaviour with a test
before moving it.

- [ ] **Step 1: Write the failing pure test**

Create `tests/draftAutosave.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fingerprint, shouldSaveDraft } from '../src/lib/draftAutosave'

describe('fingerprint', () => {
  it('is stable for equal values', () => {
    expect(fingerprint({ a: 1, b: [2] })).toBe(fingerprint({ a: 1, b: [2] }))
  })

  it('differs when a value changes', () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }))
  })
})

describe('shouldSaveDraft', () => {
  it('saves when the values changed', () => {
    expect(shouldSaveDraft(fingerprint({ a: 2 }), fingerprint({ a: 1 }))).toBe(true)
  })

  /**
   * The loop cut. A save bumps `updatedAt`, the reactive query refires, the
   * parent re-renders and hands the same values back. If that re-render saved
   * again, every open tab would write to Convex forever with nobody typing.
   */
  it('does not save when the values are unchanged', () => {
    const f = fingerprint({ a: 1 })
    expect(shouldSaveDraft(f, f)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/draftAutosave.test.ts`
Expected: FAIL — cannot resolve `../src/lib/draftAutosave`.

- [ ] **Step 3: Write `src/lib/draftAutosave.ts`**

```ts
/**
 * The decision behind draft autosave, as two pure functions.
 *
 * It is split out of the component because `shouldSaveDraft` is load-bearing:
 * it cuts a feedback loop, and a loop is exactly the kind of thing that hides
 * inside a component rewrite.
 */

export function fingerprint(value: unknown): string {
  return JSON.stringify(value)
}

/**
 * Whether a draft is worth writing.
 *
 * Saving bumps `updatedAt`, which invalidates the reactive Convex query
 * feeding the screen, which re-renders the parent, which offers the same
 * values back. Returning `true` there would mean every open tab wrote to
 * Convex on a timer forever, with nobody typing.
 */
export function shouldSaveDraft(next: string, lastSaved: string): boolean {
  return next !== lastSaved
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/draftAutosave.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the hook**

Create `src/hooks/useDraftAutosave.ts`:

```ts
import { useEffect, useRef } from 'react'
import { fingerprint, shouldSaveDraft } from '../lib/draftAutosave'

/**
 * Debounced draft autosave.
 *
 * An eight-section form with a one-page letter cannot be lost because the
 * wifi dropped at the club.
 */
export function useDraftAutosave<T>({
  values,
  initial,
  enabled,
  delayMs = 1200,
  onSave,
}: {
  values: T
  /**
   * What the server already has. Seeding `lastSaved` with it is what makes
   * opening the form and touching nothing save nothing.
   */
  initial: T
  enabled: boolean
  delayMs?: number
  onSave: (values: T) => void
}): void {
  const lastSaved = useRef(fingerprint(initial))

  useEffect(() => {
    if (!enabled) return
    const next = fingerprint(values)
    if (!shouldSaveDraft(next, lastSaved.current)) return

    const t = setTimeout(() => {
      lastSaved.current = next
      onSave(values)
    }, delayMs)
    return () => clearTimeout(t)
  }, [values, enabled, delayMs, onSave])
}
```

- [ ] **Step 6: Write the hook's regression test**

Create `tests/components/useDraftAutosave.test.tsx`:

```tsx
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraftAutosave } from '../../src/hooks/useDraftAutosave'

function Harness({
  values,
  onSave,
  initial,
}: {
  values: { a: number }
  initial: { a: number }
  onSave: (v: { a: number }) => void
}) {
  useDraftAutosave({ values, initial, enabled: true, delayMs: 1200, onSave })
  return null
}

describe('useDraftAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves once after the debounce when values change', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const { rerender } = render(
      <Harness values={initial} initial={initial} onSave={onSave} />,
    )
    rerender(<Harness values={{ a: 1 }} initial={initial} onSave={onSave} />)
    act(() => void vi.advanceTimersByTime(1300))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not save when nothing was touched', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    render(<Harness values={{ a: 0 }} initial={initial} onSave={onSave} />)
    act(() => void vi.advanceTimersByTime(5000))
    expect(onSave).not.toHaveBeenCalled()
  })

  /**
   * THE regression. After a save, the reactive query refires and the parent
   * re-renders with the same values. That must not trigger another save, or
   * every open tab writes to Convex forever.
   */
  it('does not save again when re-rendered with the values it just saved', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const { rerender } = render(
      <Harness values={initial} initial={initial} onSave={onSave} />,
    )

    rerender(<Harness values={{ a: 1 }} initial={initial} onSave={onSave} />)
    act(() => void vi.advanceTimersByTime(1300))
    expect(onSave).toHaveBeenCalledTimes(1)

    // The re-render caused by the save landing.
    rerender(<Harness values={{ a: 1 }} initial={initial} onSave={onSave} />)
    act(() => void vi.advanceTimersByTime(5000))
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npx vitest run tests/components/useDraftAutosave.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/draftAutosave.ts src/hooks tests/draftAutosave.test.ts tests/components/useDraftAutosave.test.tsx
git commit -m "test(autosave): pin the loop cut before rewiring the form

Saving bumps updatedAt, which refires the reactive query and
re-renders with the same values. Without the fingerprint compare,
every open tab wrote to Convex every 1.2s with nobody typing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 17: Rewire `RegistrationForm` onto TanStack Form

**Files:**
- Modify: `src/components/RegistrationForm.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: the field components from Task 11; the chrome from Task 12; `useDraftAutosave` from Task 16; the field rules from Task 5.
- Produces: `RegistrationForm` with per-field inline errors. Props are unchanged.

- [ ] **Step 1: Install TanStack Form**

```bash
npm install @tanstack/react-form@^1.33.5
```

- [ ] **Step 2: Replace the state and the autosave**

Add the imports:

```tsx
import { useForm, useStore } from '@tanstack/react-form'
import { useDraftAutosave } from '../hooks/useDraftAutosave'
import { computeProgress } from '../lib/registrationProgress'
import {
  checkBranch,
  checkBirthDate,
  checkEmail,
  checkGraduationYear,
  checkLetter,
  checkName,
  checkRequiredText,
  checkWhatsapp,
  validateRegistration,
} from '../lib/registrationRules'
import type { RegistrationError } from '../lib/registrationRules'
```

Then, at the top of the component:

```tsx
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      const serverErrors = await onSubmit(value)
      setErrors(serverErrors)
      if (serverErrors.length > 0) focusFirstError(serverErrors)
    },
    // `formApi` comes from the callback: referencing `form` here would close
    // over the binding before `useForm` has returned it.
    onSubmitInvalid: ({ formApi }) => {
      const localErrors = validateRegistration(formApi.state.values)
      setErrors(localErrors)
      focusFirstError(localErrors)
    },
  })

  const values = useStore(form.store, (s) => s.values)

  useDraftAutosave({
    values,
    initial,
    enabled: editable,
    onSave: onSaveDraft,
  })

  const progress = useMemo(() => computeProgress(values), [values])
```

Delete `data`, `setData`, `set`, the old `useEffect`, `lastSaved`, and
`submitting` (TanStack Form exposes `isSubmitting`).

- [ ] **Step 3: Add the focus helper above the component**

```tsx
/**
 * Moves the caret to the first thing that is wrong.
 *
 * On an eight-section form, a summary that says what is wrong without taking
 * you there is a scavenger hunt. The input ids are the field paths (see
 * ErrorSummary), so the first error names its own element.
 */
function focusFirstError(errors: RegistrationError[]): void {
  const first = errors[0]
  if (!first) return
  const el = document.getElementById(first.field)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
    return
  }
  document.getElementById('errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
```

`focusFirstError` is a plain function, not a component, so `react/no-multi-comp`
does not fire on it.

- [ ] **Step 4: Convert the form element and one field, as the pattern**

```tsx
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
      noValidate
    >
      <ProgressBar percent={progress} />
      <ErrorSummary errors={errors} />

      <FormSection n={1} title={m.reg_s1_title()} sub={m.reg_s1_sub()}>
        <FieldGrid>
          <form.Field
            name="personal.name"
            validators={{ onBlur: ({ value }) => checkName(value), onChange: ({ value }) => checkName(value) }}
          >
            {(field) => (
              <TextField
                id="personal.name"
                label={m.reg_name()}
                req
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                /*
                 * Only after the field has been left. Marking a field red
                 * while it is still being typed into for the first time is
                 * how a form feels hostile.
                 */
                error={field.state.meta.isTouched ? field.state.meta.errors[0] : undefined}
                autoComplete="name"
              />
            )}
          </form.Field>
          {/* ...the other five fields of section 1, same shape */}
        </FieldGrid>
      </FormSection>
```

Validator-to-field mapping for the rest:

| Field | `validators`  |
|---|---|
| `personal.email` | `checkEmail(value)` |
| `personal.whatsapp` | `checkWhatsapp(value)` |
| `personal.birthDate` | `checkBirthDate(value)` |
| `personal.branch` | `checkBranch(value)` |
| `personal.cityState` | `checkRequiredText(value, 'city_required')` |
| `academic.school` | `checkRequiredText(value, 'school_required')` |
| `academic.grade` | `checkRequiredText(value, 'grade_required')` |
| `academic.graduationYear` | `checkGraduationYear(value)` |
| `academic.interest` | none — optional, free text |
| `athletic.club` | `checkRequiredText(value, 'club_required')` |
| `athletic.coach` | `checkRequiredText(value, 'coach_required')` |
| `athletic.ghin` | `checkRequiredText(value, 'ghin_required')` |
| `motivationLetter` | `checkLetter(value)` |
| `confirmations.rules` | `value ? undefined : 'confirm_rules_required'` |
| `confirmations.scholarshipUnderstood` | `value ? undefined : 'confirm_scholarship_required'` |
| `confirmations.privacy` | `value ? undefined : 'confirm_privacy_required'` |

`athletic.amateurStatus` gets no validator. Its type is `boolean`, so
"professional" and "not answered" are the same value and required-ness cannot
be expressed — see Known Limitations.

- [ ] **Step 5: Convert the three array sections**

Results (section 4) and calendar (section 6):

```tsx
          <form.Field name="results" mode="array">
            {(field) => (
              <DynamicRows
                rows={field.state.value.map((r) => ({ a: r.tournament, b: r.result }))}
                phA={m.reg_tournament_name()}
                phB={m.reg_tournament_result()}
                addLabel={m.reg_add_tournament()}
                onChange={(rows) =>
                  field.handleChange(rows.map((f) => ({ tournament: f.a, result: f.b })))
                }
              />
            )}
          </form.Field>
```

Rankings (section 5) keeps its existing bespoke markup — the four fixed rows
plus one free row — wrapped in a single `<form.Field name="rankings" mode="array">`.

- [ ] **Step 6: Convert the submit button**

```tsx
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <button type="submit" className="btn" disabled={!editable || isSubmitting}>
            {isSubmitting
              ? m.common_loading()
              : alreadySubmitted
                ? m.reg_save_changes()
                : m.reg_submit()}
          </button>
        )}
      </form.Subscribe>
```

- [ ] **Step 7: Verify**

Run: `npm run check`
Expected: PASS — lint, typecheck, tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/RegistrationForm.tsx package.json package-lock.json
git commit -m "feat(form): move RegistrationForm onto TanStack Form

Errors render against their field with aria-invalid and
aria-describedby, validate on blur, and submit moves focus to the
first thing that is wrong.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 18: Prove the new behaviour

**Files:**
- Create: `tests/components/RegistrationForm.test.tsx`

**Interfaces:**
- Consumes: `RegistrationForm`, `emptyRegistration`.
- Produces: coverage of the three behaviours this stage was for.

- [ ] **Step 1: Write the test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RegistrationForm from '../../src/components/RegistrationForm'
import { emptyRegistration } from '../../convex/lib/registrationSchema'

function setup(overrides: Partial<Parameters<typeof RegistrationForm>[0]> = {}) {
  const props = {
    initial: emptyRegistration(),
    editable: true,
    alreadySubmitted: false,
    onSaveDraft: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
  render(<RegistrationForm {...props} />)
  return props
}

describe('RegistrationForm', () => {
  it('does not mark a field before it has been left', async () => {
    const user = userEvent.setup()
    setup()
    const email = screen.getByLabelText(/correo|email/i)
    await user.type(email, 'not-an-email')
    expect(email).not.toHaveAttribute('aria-invalid')
  })

  it('marks the field on blur and says why, next to it', async () => {
    const user = userEvent.setup()
    setup()
    const email = screen.getByLabelText(/correo|email/i)
    await user.type(email, 'not-an-email')
    await user.tab()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    // The message is wired to the input, not stranded in a banner.
    const describedBy = email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!.split(' ')[0])).toHaveTextContent(/./)
  })

  it('clears the error once the value becomes valid', async () => {
    const user = userEvent.setup()
    setup()
    const email = screen.getByLabelText(/correo|email/i)
    await user.type(email, 'nope')
    await user.tab()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    await user.clear(email)
    await user.type(email, 'ana@example.com')
    expect(email).not.toHaveAttribute('aria-invalid')
  })

  it('does not call onSubmit when the form is invalid', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: /enviar|submit/i }))
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('moves focus to the first invalid field on submit', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /enviar|submit/i }))
    expect(document.activeElement?.id).toBe('personal.name')
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/components/RegistrationForm.test.tsx`
Expected: PASS, 5 tests. If `getByLabelText` is ambiguous, narrow with the
input's `id` (`document.getElementById('personal.email')`) rather than loosening
the regex — the ids are the field paths and are stable.

- [ ] **Step 3: Commit**

```bash
git add tests/components/RegistrationForm.test.tsx
git commit -m "test(form): cover blur validation, inline errors and focus

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 19: Move `BirthDateForm` onto TanStack Form

**Files:**
- Modify: `src/components/BirthDateForm.tsx`
- Create: `tests/components/BirthDateForm.test.tsx`

**Interfaces:**
- Consumes: `checkBirthDate` from `src/lib/registrationRules.ts`; `checkGuardianName`, `checkGuardianEmail` from `src/lib/guardianRules.ts`.
- Produces: `BirthDateForm` with the same props as Task 14.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import BirthDateForm from '../../src/components/BirthDateForm'

describe('BirthDateForm', () => {
  it('hides the guardian fields for an adult', async () => {
    const user = userEvent.setup()
    render(<BirthDateForm lede="x" submitLabel="Continuar" onSubmit={vi.fn()} />)
    await user.type(screen.getByLabelText(/nacimiento|birth/i), '1995-04-11')
    expect(screen.queryByLabelText(/tutor|guardian/i)).not.toBeInTheDocument()
  })

  it('reveals the guardian fields for a minor', async () => {
    const user = userEvent.setup()
    render(<BirthDateForm lede="x" submitLabel="Continuar" onSubmit={vi.fn()} />)
    await user.type(screen.getByLabelText(/nacimiento|birth/i), '2014-04-11')
    expect(screen.getAllByLabelText(/tutor|guardian/i).length).toBeGreaterThan(0)
  })

  /**
   * The hole this component was built to close. Without it a minor puts their
   * own address in as their guardian's and authorizes their own account.
   */
  it("refuses a guardian email equal to the registrant's own", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <BirthDateForm
        lede="x"
        submitLabel="Continuar"
        ownEmail="ana@example.com"
        onSubmit={onSubmit}
      />,
    )
    await user.type(screen.getByLabelText(/nacimiento|birth/i), '2014-04-11')
    await user.type(document.getElementById('guardianName')!, 'Rosa Gómez')
    await user.type(document.getElementById('guardianEmail')!, 'ANA@example.com')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(document.getElementById('guardianEmail')).toHaveAttribute('aria-invalid', 'true')
  })

  it('submits a valid minor declaration', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<BirthDateForm lede="x" submitLabel="Continuar" onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/nacimiento|birth/i), '2014-04-11')
    await user.type(document.getElementById('guardianName')!, 'Rosa Gómez')
    await user.type(document.getElementById('guardianEmail')!, 'rosa@example.com')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(onSubmit).toHaveBeenCalledWith({
      birthDate: '2014-04-11',
      guardianName: 'Rosa Gómez',
      guardianEmail: 'rosa@example.com',
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/BirthDateForm.test.tsx`
Expected: FAIL on the same-email case — the Task 14 version validates only on
submit and does not set `aria-invalid` via TanStack Form's field meta.

- [ ] **Step 3: Rewire the component**

Replace the three `useState`s and `handleSubmit` with `useForm`:

```tsx
  const form = useForm({
    defaultValues: { birthDate: '', guardianName: '', guardianEmail: '' },
    onSubmit: async ({ value }) => {
      setFormError(null)
      try {
        await onSubmit({
          birthDate: value.birthDate,
          guardianName: isMinor ? value.guardianName.trim() : undefined,
          guardianEmail: isMinor ? value.guardianEmail.trim().toLowerCase() : undefined,
        })
      } catch (err) {
        // The server revalidates everything and can know things the client
        // cannot. Its answer wins.
        setFormError(describeConvexError(err))
      }
    },
  })

  const birthDate = useStore(form.store, (s) => s.values.birthDate)
  const isMinor = birthDate ? isUnderage(birthDate) : false
```

Each field gets a validator, guarded so the guardian rules only apply to minors:

```tsx
  <form.Field
    name="guardianEmail"
    validators={{
      onBlur: ({ value }) => (isMinor ? checkGuardianEmail(value, ownEmail) : undefined),
      onChange: ({ value }) => (isMinor ? checkGuardianEmail(value, ownEmail) : undefined),
    }}
  >
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/BirthDateForm.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole check**

Run: `npm run check`
Expected: PASS — lint, typecheck, every test.

- [ ] **Step 6: Confirm the unused messages are used now**

```bash
for k in gate_guardian_email_same reg_ck_rules_error reg_progress reg_errors_title status_draft; do
  n=$(grep -rl "m\.$k" src convex 2>/dev/null | grep -v paraglide | tr '\n' ' ')
  printf "%-28s %s\n" "$k" "${n:-STILL UNUSED}"
done
```

Expected: every key names at least one file. `reg_status_error` remains unused
by design — see Known Limitations.

- [ ] **Step 7: Commit**

```bash
git add src/components/BirthDateForm.tsx tests/components/BirthDateForm.test.tsx
git commit -m "feat(form): move BirthDateForm onto TanStack Form

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Done

Run `npm run check` one last time, then open the PR. The four stages are
separately reviewable commits; the autosave loop-cut test and the
guardian same-email test are the two worth a reviewer's attention.
