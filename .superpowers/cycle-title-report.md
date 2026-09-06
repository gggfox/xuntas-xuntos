# Cycle key/title split + registration-window date format — report

Branch: `feat/admin-review` (confirmed with `git branch --show-current` before any work).

## Change A — a call's name is a key; its title is free text

### The key rule I settled on

`convex/lib/cycleRules.ts`:

```ts
const KEY_RE = /^[a-z0-9-]{2,40}$/i
```

Case-insensitive, 2–40 characters, letters/digits/dashes only, stored as typed (no
lower-casing). Accepts `2026-2027`, `2026-2027-verano`, `beca-invierno`,
`BECA-INVIERNO`; rejects spaces, underscores, slashes, a single character, and
anything past 40 characters. New error code `cycle_key_invalid` replaces
`cycle_name_invalid` (renamed everywhere it appeared: `convex/lib/errorCodes.ts`,
`src/lib/registrationErrors.ts`, `messages/es.json` / `en.json`,
`tests/cycleRules.test.ts`).

`validateCycle`'s input (`CycleInput`) gained `title: string`. A blank or
whitespace-only title returns the new code `cycle_title_required`. Both checks
run before the date checks, same order as before (key/title, then dates, then
review-after-close).

### `titleOf` and `cycleTitle`

- `titleOf(cycle, locale)` is unchanged in behavior; its doc comment now says
  explicitly that it is the fallback for a row written before titles existed,
  and what `cycles.seed` writes as the 2026–2027 row's actual title.
- New `cycleTitle(row: { cycle: string; title?: string }, locale): string`
  returns `row.title?.trim() || titleOf(row.cycle, locale)`. Every place that
  displays or emails a call's name now goes through this — never `titleOf`
  directly, never a raw `row.title`.

### Schema (`convex/schema.ts`)

- `cycles.title` — `v.optional(v.string())`. Optional is deliberate and
  permanent-until-migrated: the dev deployment already holds the seeded
  2026–2027 row with no `title` field at all, and a required field would be
  rejected on push against it. Comment says so and points at `cycleTitle` as
  what covers the gap for a reader.
- `vCycleFields` (the `cycleChanges` audit shape) gained the same optional
  `title`, so a title edit shows up in a row's change history like any other
  field.

### `convex/cycles.ts`

- `create` / `update` take `title: v.string()` and write `args.title.trim()`.
  `update` still keys off `cycle` to find the row — the key never changes,
  only found by it.
- `seed` writes `title: titleOf('2026-2027', 'es')` — a NEW seed run would now
  produce a titled row; the existing dev row was seeded before this change and
  was not re-seeded (seed is idempotent — it no-ops if the row already exists —
  so I did not touch the live row).
- `active` (public, used by `useActiveCycle`) now takes `{ locale: 'es' | 'en' }`
  and returns `title: cycleTitle(row, args.locale)` instead of the raw key.
  Locale had to become an argument here because the fallback text differs by
  language and this query has no other way to know which language the caller
  wants.
- `list` (staff) returns both `title` (raw, possibly `undefined` — what is
  actually stored, for the edit form to fill in) and `displayTitle` (resolved
  via `cycleTitle`, always a real string — what today's reader sees for that
  row). Names chosen to be unambiguous about which is which.

### `convex/emails.ts` and its call sites

`sendAthleteConfirmation`, `sendGuardianAuthorization`, `sendDecisionNotice`,
and `sendDecisionTest` all changed their `cycle: v.string()` argument to
`cycleTitle: v.string()`. `emails.ts` no longer imports `titleOf` at all —
resolution happens once, at the call site that already has the cycle row (or
can cheaply fetch it), via `cycleTitle(row, 'es')`:

- `convex/registrations.ts` — `sendAthleteConfirmation`'s one call site; had
  the active-cycle row already in `cycle`.
- `convex/guardian.ts` — `sendGuardianAuthorization`'s two call sites
  (`resend`, `correctEmail`); both had `cycle` from `activeCycle(ctx)` already.
- `convex/users.ts` — `sendGuardianAuthorization`'s third call site, inside
  `openGuardianAuthorization`; took `cycle: Doc<'cycles'>` as a parameter
  already.
- `convex/notices.ts` — three call sites needed different treatment since none
  of them previously received a `cycle` argument to shift the resolution onto:
  - `sendRejection` only had the registration row (`r.cycle`, a key, no
    title). It now fetches the matching `cycles` row and falls back to
    `cycleTitle({ cycle: r.cycle }, 'es')` if somehow not found (should not
    happen — cycles are never deleted — but the registration row's own `cycle`
    key still resolves through `titleOf` if it did).
  - `sendBatch` already fetched the `cycles` row at the top to check the
    window; resolves the title once before the loop instead of once per
    scheduled email.
  - `sendTest` only had `args.cycle` (a key); now fetches the row and fails
    `cycle_not_found` if it is missing, same as `sendBatch` already did.

`headerLineFor` used to take the cycle KEY and format it as `"Convocatoria
2026–2027"` (a short form distinct from `titleOf`'s "Convocatoria General
2026–2027"). Since every caller now already has the resolved, full title in
hand, `headerLineFor` just returns that string (escaped via `textForEmail`,
since a title is free text an admin typed and it lands inside the header
banner's HTML — the old key-derived string needed no escaping, a typed title
does).

### Client

- `src/hooks/useActiveCycle.ts` — no longer imports or calls `titleOf`. Passes
  `{ locale }` to `api.cycles.active` and uses the `title` the query already
  resolved. Every consumer of the hook (`SignInScreen`, `NotFoundScreen`,
  `ErrorScreen`, `SignUpScreen`, `SessionFrame`, `SyncingFrame`,
  `RegistrationPanel`, `BrandLink`, route files, etc.) reads `.title` off the
  hook's return value exactly as before — none of them needed changes.
- `src/components/Admin/CycleForm.tsx` — two fields at the top now: the key
  (label unchanged — "Nombre"/"Name" — locked when editing, placeholder
  `2026-2027-verano`, help text rewritten to name the allowed characters and
  give the three examples from the spec) and the title (new field, always
  editable, plain free text, help text says this is what families see and
  that it can be edited any time).
- `src/components/Admin/CyclesPanel.tsx` — each row's heading is now
  `c.displayTitle` (`<b className="font-disp text-[15px]">`) with the key
  beside it as `<span className="eyebrow">{c.cycle}</span>` — reusing the
  existing `eyebrow` utility class rather than inventing new styling. Editing
  a row passes `initial={{ ...c, title: c.title ?? '' }}` — the RAW title
  (blank if the row has none), not `displayTitle`, so the untitled dev row
  shows an empty title box to fill in rather than silently pre-filling the
  fallback text as if someone had typed it.

### Messages (`messages/es.json` / `en.json`, both, same key set, `npm run paraglide` run afterward)

- `err_cycle_name_invalid` → `err_cycle_key_invalid` (renamed, text rewritten
  to describe the new rule).
- New `err_cycle_title_required`.
- `cycles_name_help` rewritten for the new key rule and examples.
- New `cycles_title_label` / `cycles_title_help` (deliberately NOT named
  `cycles_title`, since that key already means the panel's own page heading —
  "Convocatorias"/"Calls for applications" — a different thing).
- New `range_reversed` for Change B (below).
- `src/lib/registrationErrors.ts`'s `MESSAGES` map updated to match
  (`cycle_key_invalid`, `cycle_title_required` wired in; old
  `cycle_name_invalid` entry removed since nothing throws that code anymore).

### Tests (`tests/cycleRules.test.ts`)

Added, alongside the existing suite (all of which still passes unchanged
except the renamed-code assertions):
- Accepts the three example keys (`2026-2027`, `2026-2027-verano`,
  `beca-invierno`) and a fully-uppercase key.
- Rejects spaces, underscores, slashes, a 1-character key, and a 41-character
  key — all as `cycle_key_invalid`.
- `cycle_title_required` for an empty and a whitespace-only title.
- `cycleTitle`: prefers a typed title; falls back to `titleOf` for a missing,
  empty, or whitespace-only title, in both locales.

## The fallback and the untitled dev row

I did not seed or touch the live dev row's `title` field. After
`npx convex dev --once` pushed the new (optional) schema field successfully, I
confirmed by running the actual public query against the dev deployment:

```
$ npx convex run cycles:active '{"locale":"es"}'
{ ..., "cycle": "2026-2027", "title": "Convocatoria General 2026–2027", ... }
$ npx convex run cycles:active '{"locale":"en"}'
{ ..., "cycle": "2026-2027", "title": "2026–2027 General Call for Applications", ... }
```

This is the exact row the landing page and the calls screen read: `active`
resolves it via `cycleTitle(row, args.locale)`, `row.title` is `undefined` on
this row, so `cycleTitle` falls through to `titleOf(row.cycle, locale)` —
which is exactly the string every screen already showed before this change.
So: the landing page (via `useActiveCycle` → title prop → `RegistrationLede`),
the emails (via each call site's own `cycleTitle(cycle, 'es')`), and the
admin calls screen (`CyclesPanel`'s `displayTitle`, same helper) all continue
to render a real title for this row without anyone having typed one yet — the
only visible change for that one row is that editing it now shows an empty
title box waiting to be filled in, which is the intended nudge to give it a
real title on the next edit.

## Change B — the registration window's boxes take the app's date format and validate

`src/components/DateField/RangeField.tsx` was rewritten. Before this change,
its two boxes were `value={start}` / `value={end}` bound directly to the raw
ISO string with a static `aaaa-mm-dd` placeholder and no masking or
validation at all — typing `2026-09-33` into CLOSES just sat there as literal
text until submit, when `validateCycle` finally rejected it with a generic
"dates invalid" message that didn't point at which box was wrong.

It now mirrors `DateField` exactly:
- `useDateFormats()` for `dayFirst`; `mask`, `isoToText`, `textToISO` from
  `./format` — same masking, same locale-ordered display text
  (`dd/mm/aaaa` in Spanish), same `m.date_placeholder()`. The value the
  component emits via `onChange` is still ISO `yyyy-mm-dd` — only the display
  changed.
- Each box keeps its own local text state (`startText`/`endText`) and its own
  "last emitted ISO" ref, resynced from the `start`/`end` props exactly the
  way `DateField` resyncs from `value` — so a grid pick or an external reset
  updates the box's text without wiping out a half-typed or rejected entry.
- Each box's local error is derived exactly as `DateField` derives its own:
  nothing while the digits typed so far are fewer than 8 (a complete day),
  `m.date_invalid()` once complete but not a real calendar day, and the
  field's existing `m.gate_date_future()` / `m.gate_date_implausible()` for a
  complete, real day outside `min`/`max` (reused rather than new copy, per
  the spec).
- New range-level rule: once BOTH boxes hold a complete, valid, in-range day,
  and the closing day is before the opening day, the END box reports
  `m.range_reversed()` (new message, added to both locale files) instead of
  its own local error — the two are mutually exclusive by construction
  (the range check only runs once neither box already has its own complaint).
- `aria-invalid` and `aria-describedby` on each box independently, each
  pointing at its own reserved-height paragraph directly below it (moved
  outside the `<label>` so the error text never becomes part of the box's
  accessible name — it used to be nested inside an implicit `<label>` wrapper,
  which would have made the label text change as the error appeared/cleared).
- The grid's two-click / swap behavior (`pick`) is untouched — same code, same
  behavior, still the caller of `onChange` for a grid click.
- The shared bottom paragraph (`error` prop override, else `m.range_hint()`)
  is unchanged in purpose — it is not wired to any box's `aria-describedby`
  any more, since each box now describes itself.

### Tests (`tests/components/RangeField.test.tsx`)

All four existing grid-click tests are untouched and still pass. Added, under
a new `describe('typing into the boxes', …)`:
- Typing a half-typed day (4 digits) reports nothing and emits `''` for that
  side.
- Typing a complete but impossible day (`02/30/2026`, this jsdom harness
  resolves to English so mm/dd/yyyy) reports `m.date_invalid()` and sets
  `aria-invalid="true"` on that box.
- Typing a well-formed day in the locale's order (`09/04/2026`) updates the
  box's displayed text and calls `onChange` with the ISO value.
- Rendering with `start = '2026-09-18'` and typing `09/04/2026` into the
  CLOSES box (both valid, in-range days on their own) reports
  `m.range_reversed()`, sets `aria-invalid="true"` on the end box only
  (`date_invalid` is asserted absent), and still emits both sides through
  `onChange` (`{ start: '2026-09-18', end: '2026-09-04' }`) — the value keeps
  moving even though the pair reads as backwards, same as `DateField` lets a
  single out-of-range day still update state while complaining about it.

I confirmed via a throwaway probe test (not committed) that this jsdom harness
resolves Paraglide's locale to `en`, matching the existing comment in
`tests/components/RegistrationForm.test.tsx` — so the new tests type
`mm/dd/yyyy`-order digit strings deliberately, not by accident.

## Commands and output

```
$ git branch --show-current
feat/admin-review

$ npm run paraglide        # after every messages/*.json edit
(regenerates src/paraglide/messages/*.js — clean)

$ npm run check            # typecheck + full test suite
...
Test Files  30 passed (30)
     Tests  351 passed (351)

$ npx convex dev --once
✔ Convex functions ready! (3.2s)   ← schema accepted over the existing dev row

$ npx convex run cycles:active '{"locale":"es"}'
{ ..., "title": "Convocatoria General 2026–2027" }   ← fallback confirmed live
```

351 tests total (342 baseline + 9 net new: 6 in `tests/cycleRules.test.ts`,
4 in `tests/components/RangeField.test.tsx`, offset by nothing removed).

## Exceptions / things worth flagging

- `src/components/Admin/CycleSelect.tsx` (a different admin dropdown, used to
  switch which cycle the registrations/staff tables look at) still shows the
  raw key (`c.cycle`) in its `<option>` text, not `displayTitle`. The spec
  only asked for `CyclesPanel`'s display to change, so I left this one alone
  rather than guessing at scope — it is a one-line follow-up
  (`{c.displayTitle}` instead of `{c.cycle}`, since `list` now returns both)
  if the client wants it too.
- Nothing else deviated from the spec as written; every numbered item in both
  Change A and Change B was implemented as described.
