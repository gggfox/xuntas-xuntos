# Dark mode, with the preference remembered per account

**Date:** 2026-08-31
**Branch:** `feat/dark-mode` (to be cut from `feat/registration-multi-step`)
**Status:** designed, not implemented.

## Problem

The app is light-only by decision, not by omission. `docs/BRAND.md` says so in
as many words — *"There is no dark mode. It is a decision, not a to-do"* — and
the decision is enforced in two places: `color-scheme: light only` in
`src/styles.css`, and `<meta name="color-scheme" content="light only">` in
`src/routes/__root.tsx`.

XUNTAS now wants dark mode, and wants a signed-in person's choice to follow
them across devices.

**This spec reverses a documented brand decision.** The 2025 Brands&People
guideline has no dark palette, so the one below is derived rather than
approved. That is a real gap and it is recorded here rather than hidden: if
the agency later supplies a dark palette, the values in `styles.css` get
corrected the same way BRAND.md already says they would.

### What makes this cheap

The codebase is unusually token-disciplined. Almost every color reaches the
screen through a `@theme` custom property, so the bulk of dark mode is
redefining variables, not editing components. The complete set of exceptions —
places where a color is written as a literal and would not follow — is:

| File | Literal |
|---|---|
| `src/components/DateField/calendar.css` | `rgba(22,22,21,.05)` x2, `rgba(22,22,21,.055)`, `rgba(22,22,21,.2)` |
| `src/components/RegistrationForm/CheckboxField.tsx:52` | `rgba(235,244,55,0.5)` focus ring |
| `src/styles.css` — `.btn-ghost:hover` | `rgba(22,22,21,.045)` |
| `src/styles.css` — `.fld-input:disabled` | `rgba(22,22,21,.035)` |
| `src/styles.css` — `.fld-input:focus` | `rgba(235,244,55,.4)` |
| `src/styles.css` — `.fld-input[aria-invalid]` | `rgba(179,38,30,.03)` |
| `src/styles.css` — `.chip-ok/.chip-warn/.chip-bad` | six rgba literals derived from the semantic hexes |
| `src/lib/clerkAppearance.ts` | nine hexes handed to Clerk |

Everything else already follows the tokens — but "follows the tokens" is not
the same as "survives the inversion". See section 3.

## Decisions taken during design

- **D1 — the dark palette inverts the paper.** The page becomes the warm black
  the system already owns, the bone becomes the text. Every existing token
  gets a counterpart; nothing new is invented. Rejected: neutral greys, which
  drop the warmth BRAND.md names as the point of `#161615` over `#000`.
- **D2 — the yellow does not change.** `--color-yel` stays the guideline's
  `#ebf437` in both themes. Rejected: dialling it to `--color-yel-d` on dark.
- **D3 — semantic colors get lighter counterparts.** Green, amber and red at
  their light-mode values fail contrast on a dark card. BRAND.md calls
  accessibility non-negotiable, so they are re-derived at the same hue.
- **D4 — three states: system, light, dark.** Default is system. Someone who
  never touches the control still gets dark at night.
- **D5 — the preference lives on the `users` table.** Rejected: Clerk
  `unsafeMetadata`, which re-introduces a pattern `convex/schema.ts` argues
  against at length.
- **D6 — on conflict, an explicit saved preference wins.** That is what makes
  "remember my preference" true on a borrowed laptop. If the account has no
  saved value, the local one is adopted and pushed up.
- **D7 — one cycling button, not a segmented control.** Chosen for its size.
  Its known usability cost is paid down in section 5 rather than ignored.
- **D8 — the header does not change.** It stays solid `#161615` with white
  text and a yellow mark in both themes. It therefore cannot be painted with
  `--color-ink`, which inverts; it gets a pinned token of its own (section 3). The dark page sits *below* it at
  `#0f0f0e`, so the band still separates by a half tone — the same
  paper-vs-card trick, inverted. This also avoids putting the yellow mark on a
  light background, which BRAND.md forbids.

## Non-goals

- **Emails stay light.** `convex/lib/html.ts` builds inline-styled HTML for
  mail clients, which have no reliable theme signal. Untouched.
- **The favicon stays as it is.** Its ink tile already works on either tab
  strip; that is why it exists.
- No per-page or per-route theming.
- No dark variants of brand assets in `documentation/`.
- No automated contrast assertions (see Testing).

## Design

### 1. The token layer

Tailwind v4's `@theme` emits real custom properties on `:root`, and utilities
compile to `var(--color-ink)` rather than to a baked hex. Overriding those same
properties under a selector therefore re-colors every utility in the app —
including opacity modifiers such as `text-ink/50`, which compile to a
`color-mix()` over the same variable.

The light values stay exactly where they are, in `@theme`. Dark is one block:

```css
:root[data-theme="dark"] {
  color-scheme: dark;

  --color-paper: #0f0f0e;   /* below the header's #161615, on purpose — D8 */
  --color-card:  #1c1c1b;

  --color-ink:   #fafaf8;   /* the bone becomes the text */
  --color-ink-2: #e4e4e0;   /* the weights step away from the page, as in light */
  --color-ink-3: #cfcfca;
  --color-soft:  rgba(250, 250, 248, 0.60);

  --color-line:   rgba(250, 250, 248, 0.13);
  --color-line-2: rgba(250, 250, 248, 0.24);

  --color-yel-s: #24260f;   /* the .nota panel, deepened; its border stays yel-line */
  --color-ochre: #d4dd6a;   /* "yellow text on the page" inverts to a light olive */

  --color-ok:   #4ade80;
  --color-warn: #e0a33a;
  --color-bad:  #f87171;
}
```

`--color-yel`, `--color-yel-line` and `--color-yel-d` are absent from the block
because they do not move (D2). `--color-ochre` and `--color-yel-s` do move:
both exist *because* the light theme is light — ochre is the answer to "yellow
does not contrast on paper", and `yel-s` is a near-white panel. Their reasons
invert with the background.

The alpha values are raised slightly (.58 → .60, .11 → .13, .22 → .24). Light
text on a dark ground loses more perceived contrast at a given alpha than dark
on light; holding the number would make dark mode read as washed out.

**One selector, not two.** There is no `prefers-color-scheme` copy of this
block. The script in section 2 always resolves `system` down to a concrete
`light` or `dark` before paint, so `data-theme` is always present. A no-JS
fallback would mean duplicating the palette to serve a case that cannot arise:
the registration form does not function without JavaScript.

### 2. Two tokens that must NOT invert

Inverting `--color-ink` re-colors every utility that references it — which is
the point, and which is also a trap. Anything painted on a surface that *does
not move* gets dragged along with it and breaks.

There are exactly two such surfaces, and the general rule is worth stating
because it decides every future case:

> A token naming a role **relative to the page** inverts, and everything using
> it stays coherent. A token naming a role **relative to a fixed color** must
> be pinned.

Most of the app is the first kind, and was checked one by one: the Stepper's
current-step pill (`bg-ink text-paper`), the calendar's selected day
(`background: ink; color: paper`) and `CheckboxField`'s ochre badge
(`bg-ochre text-paper`) all flip both halves together and survive untouched.

The second kind is the yellow — pinned by D2 — and the header band, pinned by
D8. Both get a constant, identical in both themes:

```css
--color-on-yel: #161615;   /* text and borders sitting on --color-yel */
--color-chrome: #161615;   /* the header band */
```

Four call sites are wrong today and would ship a bone-on-yellow primary button
and a bone header:

| Site | Now | Becomes |
|---|---|---|
| `styles.css` `.btn` | `color: var(--color-ink)`; `border: 1px solid var(--color-ink)` | `--color-on-yel` |
| `styles.css` `.chip-y` | `color`/`border-color: var(--color-ink)` | `--color-on-yel` |
| `clerkAppearance.ts` `formButtonPrimary` | `text-ink! border-ink!` over `bg-yel!` | `text-on-yel! border-on-yel!` |
| `AppBar/index.tsx:15` | `bg-ink text-white` | `bg-chrome text-white` |

And pinning `.btn` forces a fifth change. `.btn-ghost` is used as `btn
btn-ghost` in four places and overrides only `background` and `border-color` —
it inherits `.btn`'s `color`. Once that color is pinned to `#161615`, every
ghost button in dark mode is near-black text on a near-black page. `.btn-ghost`
must therefore set `color: var(--color-ink)` explicitly, which it has never
needed to do while ink and on-yel were the same value.

The `.btn` border is not cosmetic: BRAND.md requires yellow to *always* carry
an ink border, and a bone border on yellow would break that rule in the one
theme nobody proofread.

### 3. Ten new tokens for the swept literals

The literals in the Problem table are not decoration, they are three recurring
ideas. They become tokens, defined in both themes:

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--color-wash` | `rgba(22,22,21,.045)` | `rgba(250,250,248,.07)` | `.btn-ghost:hover`, `.fld-input:disabled`, calendar hover |
| `--color-faint` | `rgba(22,22,21,.20)` | `rgba(250,250,248,.26)` | calendar's out-of-month days |
| `--color-yel-ring` | `rgba(235,244,55,.40)` | `rgba(235,244,55,.30)` | `.fld-input:focus`, `CheckboxField` |
| `--color-ok-wash` / `-line` | from `#1f7a45` | from `#4ade80` | `.chip-ok` |
| `--color-warn-wash` / `-line` | from `#b26b00` | from `#e0a33a` | `.chip-warn` |
| `--color-bad-wash` / `-line` | from `#b3261e` | from `#f87171` | `.chip-bad` |
| `--color-bad-tint` | `rgba(179,38,30,.03)` | `rgba(248,113,113,.06)` | `.fld-input[aria-invalid]` |

`--color-bad-tint` exists rather than reusing `--color-bad-wash` because the
two are not the same value today: the invalid field is tinted at `.03` and the
chip at `.07`. Collapsing them would darken every invalid field in light mode,
and an error state is the last place to accept an unrequested visual change.

`calendar.css` writes `.05` in two places and `.055` in a third; all three
collapse into `--color-wash` at `.045`. That is a real, if imperceptible,
change to *light* mode — recorded here rather than smuggled in, because
"dark mode" is not licence to restyle the light theme.

The chip literals are the subtle one: `.chip-ok` writes `rgba(31,122,69,.4)`
by hand, which is `--color-ok` restated. Once `--color-ok` moves and the
literal does not, a green chip in dark mode gets light-green text inside a
dark-green border. Tokenizing them is not tidiness, it is the fix.

### 4. No flash on first paint

`RootDocument` in `src/routes/__root.tsx` renders the real `<html>` and
`<head>`, so the script goes there directly as JSX with
`dangerouslySetInnerHTML`. It is deliberately **not** routed through
`head().scripts`: that field is typed `unknown` in `@tanstack/router-core`, and
placement before first paint is the entire point.

The script reads `localStorage['xx-theme']`, resolves `system` (and any
unrecognised value) through `matchMedia('(prefers-color-scheme: dark)')`, and
stamps `data-theme` on `document.documentElement`. It is wrapped in
`try/catch`: Safari throws on `localStorage` in some privacy modes, and a
theme is not worth a blank page.

One CSS edit goes with it: in `src/styles.css`, `color-scheme: light only`
becomes `light` on `:root`, with `dark` set inside the `[data-theme="dark"]`
block. This is what makes native controls, scrollbars and form widgets follow.

The `<meta>` tags are section 5.

### 5. The meta tags

Two of them matter, both in `src/routes/__root.tsx`. The other route files each
set only a `title` and are untouched.

**`color-scheme` — corrected.** `content: 'light only'` becomes `'light dark'`.
Left as-is it is not merely stale, it actively countermands the CSS: a browser
told `light only` at the document level may refuse to honour the `dark`
`color-scheme` the `[data-theme="dark"]` block asks for, and native controls
would stay light inside a dark page.

**`theme-color` — missing entirely, and added.** This is the tag that colors
the browser and OS chrome: Safari's address bar on iOS, the status bar on
Android Chrome. Without it, the mobile chrome is painted from the page
background, so it would swing from bone to near-black between themes and clash
with the ink band directly beneath it.

D8 makes the value trivial. The header is `#161615` in *both* themes, and the
chrome sits directly above the header, so:

```html
<meta name="theme-color" content="#161615">
```

One static value, no `media` variants, no per-theme swap. This is worth
noting as a second dividend of keeping the header fixed: the alternative
design, where the header inverts to bone, would have needed two `theme-color`
tags discriminated by a `media` attribute — and `head().meta` is typed
`unknown` in `@tanstack/router-core`, exactly like `scripts`, so passing a
non-standard attribute through it would have been unverified guesswork.

There is no web app manifest in `public/`, so there is no `theme_color` there
to keep in sync. `favicon.svg` already carries an ink tile and works against
either tab strip — that is why it exists, and it is untouched.

### 6. Provider shape

Auth ordering forces a split. Local resolution needs no session; the Convex
sync needs one, and Clerk needs to be *told* the resolved theme, so it must sit
inside the theme context.

```
<ThemeProvider>                       ← owns preference + resolved, applies data-theme
  <ClerkProvider appearance={clerkAppearance(resolved)}>
    <ConvexProviderWithClerk>
      <ThemeSync />                   ← reconciles with the account (D6)
      <AppBar />                      ← contains ThemeToggle
```

`ThemeProvider` initializes its state from `document.documentElement.dataset.theme`
in a `useState` initializer, so the first client render already agrees with what
the script stamped. On the server it resolves to `light`.

`ThemeSync` renders nothing. It holds a `hasReconciled` ref and:

1. waits for `api.users.myThemePreference` to settle. It returns `undefined`
   while loading, `null` when signed out, and `{ preference }` when signed in,
   so all three states stay distinguishable — a single `null` for both of the
   last two would make this ambiguous and would push the browser's preference
   onto an account nobody was signed in to;
2. on the first settled result — if the account carries an explicit value, it
   applies it locally; otherwise, if the local preference is explicit, it
   writes the local one up;
3. thereafter, every change to `preference` is written to Convex;
4. on sign-out it resets its own gate, so signing in as someone else in the
   same tab reconciles again rather than keeping the previous person's theme.

Two refs — `reconciled` and `lastPushed` — are what stop steps 2 and 3 from
feeding each other. `ThemeProvider` deliberately gets no say in this: it knows
nothing about Convex, which is what lets it sit above `ClerkProvider`.

### 7. `src/lib/theme.ts` and the control

The logic is pure and lives on its own, matching how this repo already isolates
testable rules (`registrationRules.ts`, `guardianRules.ts`, `cycle.ts`):

```ts
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'xx-theme'
export function readStoredPreference(raw: string | null): ThemePreference
export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme
export function nextPreference(pref: ThemePreference): ThemePreference   // system → light → dark → system
```

`src/hooks/useTheme.ts` does the impure half: the `matchMedia` subscription
(live only while the preference is `system`), the `localStorage` write, and the
`data-theme` application.

`src/components/AppBar/ThemeToggle.tsx` is one button (D7). Cycling through
three states by guesswork is a known usability wart, and it is paid down
explicitly:

- three distinct icons added to `Icons.tsx` — sun, moon, and a half-filled
  circle for system — so state is legible without pressing;
- an `aria-label` naming both the current state and the next action
  ("Tema: automático. Cambiar a claro.");
- a visually-hidden `aria-live="polite"` region announcing each change, since a
  button whose own label changes under the cursor is not otherwise announced;
- during SSR and before mount the button renders at its final size with a
  neutral icon. The theme is not knowable on the server, and rendering the real
  icon would be a hydration mismatch and a layout shift.

Copy goes in `messages/es.json` and `messages/en.json`, both files, per
BRAND.md. New keys: `theme_label`, `theme_system`, `theme_light`, `theme_dark`,
`theme_switch_to`.

### 8. Persistence

`convex/schema.ts`:

```ts
export const vThemePreference = v.union(
  v.literal('system'), v.literal('light'), v.literal('dark'),
)
```

added to `users` as `themePreference: v.optional(vThemePreference)`. Absent
means never chosen, which behaves as `system`.

`convex/users.ts` gains two small exports:

- `setThemePreference` — a mutation over `requireUser`, patching the field and
  `updatedAt`. `declareBirthDate` already establishes that a client-callable
  mutation may patch `users`; the table comment's "written by the webhook,
  never by the client" is about the *mirrored Clerk fields*, and this is not
  one. The comment gets a clause saying so.
- `myThemePreference` — a query returning the value, or `null` when signed out.

It is deliberately **not** folded into `myStatus`. `myStatus` serves the
registration panel; the header runs on every page and must not take a
dependency on it.

`users.update`, the Clerk `user.updated` mirror, patches only
email/name/emailVerified/role and so cannot clobber the choice. Verified, and
worth a line of test.

### 9. Clerk

`clerkAppearance` becomes `clerkAppearance(theme: ResolvedTheme): Appearance`,
returning resolved hexes for the `variables` block.

Passing `var(--color-ink)` instead would be tidier and would follow the tokens
for free, but Clerk derives whole color scales from `colorPrimary`, and a
`var()` reference defeats that math. Resolved hexes are the safe form.

The `elements` block is already Tailwind classes over our own tokens
(`border-line`, `bg-card`, `text-ochre`), so it follows the theme with no edit
at all — with the single exception of `formButtonPrimary`, which is the Clerk
row of the section 2 table and does need its `text-ink!`/`border-ink!` pinned. Where the two overlap, prefer `elements`: it is the half that cannot
drift.

### 10. The meteors

`src/components/Meteors.tsx` draws nine hairline streaks fixed to the viewport,
behind the page, on `/empezar` and the registration panel. It is the site's one
decorative layer, and this design missed it on the first pass.

Two of its three colours already behave. The tail is
`linear-gradient(to right, var(--color-line-2), transparent)`, so it inverts
from dark ink on bone to translucent white on near-black — correct, and for
free. The layer's `z-index: -1` and the `isolate` it depends on are structural,
not chromatic, and are untouched.

The head is the problem. It is `var(--color-yel-line)` — `#acb522`, a yellow
*darkened specifically to survive on bone paper*, which is the one thing a
near-black page does not require. Under the section 2 rule it names a role
relative to the **page**, so it inverts; `--color-yel-line` itself stays pinned
because its other consumer is `.nota`'s border, sitting on the soft-yellow
panel. Those are two different jobs that happened to share a value, and they
split:

```css
--color-meteor: #acb522;   /* light: the muted tone bone paper needs */
--color-meteor: #ebf437;   /* dark:  the brand yellow, finally legible */
```

This does not contradict D2. The brand yellow is not moving — the meteor is
changing which of the already-pinned yellows it draws with.

**The head also gains a glow, in dark only.** The existing comment rejects one
outright, but read it again: *"a shadow is light spilling into darkness, and on
bone paper the same shadow is a yellow-green smudge that reads as a printing
fault."* That is an argument against a glow on bone and, in the same breath, an
argument **for** one on black. Light mode keeps its flat head; the comment gets
amended to say why the two differ rather than being quietly contradicted.

### 11. Documentation

- `docs/BRAND.md`: the "There is no dark mode" paragraph is replaced by the
  dark-mode rules — that the palette inverts rather than being invented, that
  the yellow does not move, that the header does not move, and that the dark
  values are derived rather than approved by the guideline. Per this repo's own
  rule, the doc changes to match the decision; it does not stay contradicting
  the code.
- `docs/DECISIONS.md`: an entry recording D1–D8 and the reversal.

## Testing

`tests/theme.test.ts` (unit, node) — written first:

- `resolveTheme` across all six pref × system combinations;
- `nextPreference` cycles system → light → dark → system and is total;
- `readStoredPreference` maps `null`, `''`, `'DARK'`, `'nonsense'` and a JSON
  blob to `system` without throwing. This is the one that matters: the key is
  attacker-writable by anyone with a console, and a bad value must degrade,
  not crash the shell.

`tests/components/ThemeToggle.test.tsx` (jsdom):

- renders the neutral icon before mount, the real one after;
- each press advances the cycle and updates `data-theme` on the root;
- `aria-label` names current state and next action at each of the three stops;
- a throwing `localStorage` does not break the button.

The four pinned call sites get their own line in the manual pass below. They
are the failure this design nearly shipped, and a bone-on-yellow submit button
is not something to rediscover in production.

**Contrast is verified in the browser, not asserted in a test.** Asserting it
would mean parsing `styles.css` at test time, which is fragile and would break
on any formatting change. Every derived value above is checked against its
surface in devtools before merge, and the ratios recorded in the PR.

On a real phone, both themes: the address bar / status bar sits flush against
the ink header rather than clashing with it. This is the one thing in the plan
a desktop browser cannot prove.

Manual verification, both themes: the registration wizard end to end, the
calendar, all four chip states, an invalid field, a disabled fieldset, the
`.nota` panel, the header band, the primary button's fill/text/border, a ghost
button beside it, and Clerk's sign-in and sign-up.

## Delivery

Stages are independently shippable and in dependency order.

1. **Token layer.** Dark block, the two pinned tokens and their four call
   sites (plus the `.btn-ghost` colour they force), the ten swept tokens, the
   script, `color-scheme`, and both meta tags. Ships as: dark mode that follows the OS, with no
   control and no persistence.
2. **The control.** `theme.ts` + tests, `useTheme`, `ThemeProvider`,
   `ThemeToggle`, messages. Ships as: a working toggle, remembered per browser.
3. **The account.** Schema field, mutation, query, `ThemeSync`. Ships as:
   remembered across devices.
4. **Clerk.** `clerkAppearance(theme)`.
5. **Docs.** BRAND.md amendment, DECISIONS.md entry.

## Risks

- **Clerk may not restyle on an `appearance` change.** If handing it a new
  object mid-session does not re-render its internals, the fallback is to move
  the affected rules from `variables` into `elements` Tailwind classes, which
  follow the tokens natively. Remounting `ClerkProvider` on a theme change is
  not an option — it would remount the app.
- **Hydration and `<html data-theme>`.** A script mutating an attribute on an
  element React also hydrates is the standard no-flash pattern and is tolerated
  in practice, but it is React 19 here and it gets verified rather than
  assumed.
- **The dark palette has no agency approval.** Stated in BRAND.md rather than
  papered over. The derived semantic colors in particular are ours.
- **A future token could reintroduce the section 2 trap.** The rule is stated
  in BRAND.md precisely so the next person adding a color asks whether it
  names a role relative to the page or to a fixed surface.
- **`--color-ochre` inverting is the most likely value to need a second pass.**
  It is the only token whose dark counterpart is not a mechanical inversion of
  its light one.
