# Registration form: validation, component split, and lint enforcement

**Date:** 2026-08-27
**Branch:** `refactor/registration-form-validation`
**Status:** approved, pending implementation plan

## Problem

Three problems, one subsystem.

1. **Validation is weak.** `validateRegistration` runs only on submit and returns a
   flat `string[]` rendered in one banner at the top of an eight-section form. No
   field knows it is invalid, so nothing is marked, nothing is focused, and the
   user scrolls hunting for what the banner is talking about.

2. **Files hold many components.** `RegistrationForm.tsx` is 619 lines and defines
   seven components. `mi-registro.tsx` defines seven more. Two unrelated files each
   define a different component called `Frame`. Nothing prevents this from growing.

3. **`src/lib/form.ts` is named after nothing.** It holds the registration data
   type, an empty-value factory, a validator, and a submit normalizer.

### Validation defects found during design

| Field | Defect |
|---|---|
| `whatsapp` | Only `.trim()` non-empty. No digit or length check. |
| `birthDate` | Only truthy. `isValidBirthDate` already exists in `convex/lib/cycle.ts` and is not called. Messages `gate_date_future` and `gate_date_implausible` are unused by the registration form. |
| `motivationLetter` | Client never enforces `LETTER_LIMIT`; only the server does, so the user learns at submit. No minimum length. |
| `graduationYear` | Unvalidated. |
| confirmations | Error text pushed is the checkbox *label* (`m.reg_ck_rules()` = "I accept the terms…"), not an error message. The error list reads as a list of statements. |
| `branch` | Validated on the client, **not** on the server. |
| guardian email | `gate_guardian_email_same` exists as a message. The check does not exist anywhere. |

### Related defects

- `AgeGate` (`routes/empezar.tsx`) and `BirthDateStep` (`routes/mi-registro.tsx`)
  collect the same three fields. `AgeGate` validates them by hand with
  `new Date()`; `BirthDateStep` does not validate at all.
- Server validation messages are hardcoded Spanish and reach a UI that has an
  English locale. Same for thrown errors (`assertWindowOpen`, `declareBirthDate`).
- Hardcoded Spanish remains in `RegistrationForm.tsx`: `"% completado"`,
  `"Falta algo antes de enviar"`, `"Quitar fila"`.
- Unused message keys: `gate_guardian_email_same`, `reg_status_error`,
  `reg_draft_saved`, `common_required`, `common_optional`.

## Non-goals

- Redesigning the eight sections or their copy. XUNTAS approved that wording; the
  existing comment in `RegistrationForm.tsx` is explicit that changing it reopens a
  conversation the calendar has no room for.
- Changing the Convex schema or the `registrations` document shape.
- Adding a formatter. The repo has no Prettier config and this does not introduce one.

## Design

### 1. Validation lives in `convex/lib/`, client re-exports

The repo already solves client/server drift this way: `src/lib/cycle.ts` re-exports
from `convex/lib/cycle.ts` precisely so the two cannot disagree about when
registration closes. Validation gets the same treatment.

```
convex/lib/registrationSchema.ts   RegistrationData, emptyRegistration,
                                   prepareForSubmit, LETTER_LIMIT, FIXED_RANKINGS
convex/lib/registrationRules.ts    validators -> error codes   [SOURCE OF TRUTH]
convex/lib/guardianRules.ts        birthDate + guardian rules, incl. same-email
convex/lib/errorCodes.ts           the code union, shared by client and server

src/lib/registrationSchema.ts      re-export
src/lib/registrationRules.ts       re-export
src/lib/guardianRules.ts           re-export
src/lib/registrationErrors.ts      code -> Paraglide message  (client only)
src/lib/registrationProgress.ts    computeProgress (moved out of the component)
```

`src/lib/form.ts` is deleted.

Rules return **error codes**, never prose:

```ts
export type FieldErrorCode =
  | 'name_required' | 'email_invalid' | 'whatsapp_invalid'
  | 'birth_date_required' | 'birth_date_future' | 'birth_date_implausible'
  | 'branch_required' | 'city_required' | ...
```

Each side maps codes to text: the client through Paraglide, the server not at all
(it returns codes). This fixes server errors being Spanish in an English session.

Rules modules import nothing from Convex and nothing from Paraglide. They are pure
and directly unit-testable.

### 2. Error shape

`validateRegistration` returns a keyed structure, not a flat list:

```ts
type RegistrationErrors = Partial<Record<FieldPath, FieldErrorCode>>
```

`FieldPath` is the dotted path TanStack Form uses (`personal.email`,
`results[0].tournament`), so a validation result maps directly onto form fields.

`ErrorSummary` still renders a list at the top for orientation, but each entry is
now a link to its field, and each field renders its own message.

### 3. Tightened rules

| Field | Rule |
|---|---|
| `name` | non-empty after trim, >= 2 chars |
| `email` | existing regex, plus trim/lowercase before test |
| `whatsapp` | >= 10 digits after stripping spaces, dashes, parens, `+` |
| `birthDate` | `isValidBirthDate` from `convex/lib/cycle.ts`: real calendar date, not future, year >= 1930. Distinct codes for future vs implausible. |
| `branch` | must be `womens` or `mens`. **Added server-side.** |
| `cityState`, `school`, `grade`, `club`, `coach`, `ghin` | non-empty after trim |
| `graduationYear` | if present, 4 digits, within current year -1 .. +12 |
| `results` | at least one row with both cells filled |
| `motivationLetter` | non-empty, >= 200 chars, <= `LETTER_LIMIT`. Enforced client-side too. |
| confirmations | each unchecked box gets its own error code with real error copy |
| guardian email | valid address **and** not equal to the registrant's own email (`gate_guardian_email_same`) |

New Paraglide keys are added for the confirmation errors and the letter-length
errors, in both `es.json` and `en.json`.

### 4. Component split

`src/components/` stays flat, matching the existing convention.

From `RegistrationForm.tsx`:
`RegistrationForm`, `FormSection`, `FieldGrid`, `TextField`, `SelectField`,
`CheckboxField`, `DynamicRows`, plus new `ProgressBar`, `ErrorSummary`, `FieldError`.
`computeProgress` moves to `src/lib/registrationProgress.ts`.

From `mi-registro.tsx`:
`MyRegistration` stays in the route. `RegistrationPanel`, `AccountStatus`,
`GuardianNotice`, `SyncingFrame` move out.

Deduplicated:
- `PageFrame` replaces the two rival `Frame` components in `mi-registro.tsx` and
  `autorizar.$token.tsx`.
- `BirthDateForm` replaces the duplicated body of `AgeGate` and `BirthDateStep`.
  The two callers differ only in their mutation and their lede copy, which become
  props.

Every route file ends with exactly one component. The `Route` export is a config
object, not a component, and does not count.

### 5. Lint enforcement

ESLint 9 flat config. Dev deps: `eslint`, `@eslint/js`, `typescript-eslint`,
`eslint-plugin-react`, `eslint-plugin-react-hooks`, `globals`.

- `react/no-multi-comp` — error, repo-wide. This is the rule for one component per file.
- Local rule `component-filename-match` in `eslint-rules/` — the file's exported
  component must match the filename. Scoped to `src/components/**` only:
  TanStack Router names route files by URL (`autorizar.$token.tsx`), so a filename
  match is impossible there by construction.
- Ignored: `src/paraglide/**`, `src/routeTree.gen.ts`, `convex/_generated/**`.

`.vscode/extensions.json` recommends the ESLint and Tailwind extensions.
`.vscode/settings.json` enables flat config and `source.fixAll.eslint` on save.

New script `npm run lint`; `npm run check` becomes `lint && typecheck && test`.

### 6. TanStack Form

`@tanstack/react-form@^1.33.5`. React 19 is a supported peer.

Plain `useForm` plus `form.Field` render props. Field state is passed down into the
presentational `TextField` / `SelectField` / `CheckboxField` components, which keeps
those components dumb, prop-driven, and one per file. `createFormHook` bound
components are deliberately not used: they generate component definitions that
would fight the one-component-per-file rule.

- Array fields (`mode="array"`) for `results`, `rankings`, `calendar`.
- Validators: `onBlur` for first feedback, `onChange` after a field has errored,
  `onSubmit` for the whole form.
- On failed submit, focus moves to the first invalid field.
- `aria-invalid` and `aria-describedby` wire each input to its `FieldError`.

**Autosave, the load-bearing part.** The current `useEffect` compares a JSON
fingerprint against a `lastSaved` ref. That comparison is not an optimization: it
cuts a feedback loop. Saving updates `updatedAt`, which invalidates the reactive
Convex query feeding the screen, which re-renders the parent, which refires the
effect. Without the cut, every open tab wrote to Convex every 1.2 seconds forever
with nobody typing.

Porting this to `useStore(form.store, s => s.values)` must preserve the cut. A
regression test asserting "no write when the incoming props change but the values
do not" is written **before** the port.

## Testing

TDD throughout; rules before wiring.

- `tests/registrationRules.test.ts` — table-driven, one case per rule, valid and
  invalid, asserting the returned code.
- `tests/guardianRules.test.ts` — includes the same-email case that has never worked.
- `tests/registrationSchema.test.ts` — the current `tests/form.test.ts`, renamed to
  match its module.
- `tests/registrationAutosave.test.ts` — the loop-cut regression.
- `tests/registrationProgress.test.ts` — progress calculation.

Parity between client and server needs no test: they import the same module.

## Delivery

One branch, `refactor/registration-form-validation`, in four stages. Each stage
leaves `npm run check` green and is committed separately.

1. **Tooling** — ESLint, local rule, `.vscode/`, scripts. Expected to fail on the
   existing violations; those failures are the map for stage 3.
2. **Rules** — shared modules, error codes, new message keys, tests. Both
   `validateRegistration` and the Convex `validate()` switch to them. Thrown errors
   become codes too.
3. **Split** — files divided, duplicates merged, lint turns green.
4. **TanStack Form** — the form is rewired; inline errors and blur validation land.

## Risks

- **Autosave loop.** Mitigated by writing the regression test first.
- **Server error shape changes** from `string[]` to code[]. Both call sites are in
  this repo and change together.
- **Live drafts.** No stored shape changes, so drafts saved before the change load
  after it. `emptyRegistration` and `prepareForSubmit` keep their behavior; only
  their file moves.
