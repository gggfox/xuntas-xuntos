# Decisions — XUNTAS+XUNTOS Registration, 2026–2027 cycle

A record of the architecture and product decisions, with the why. The code
points here when something looks odd at first glance but is deliberate.

Last reviewed: August 26, 2026.

---

## Product

**The window runs September 4–18, 2026.** The 4th, not the 1st: the prototypes
said both things and XUNTAS confirmed the 4th. The constants live in
`convex/lib/cycle.ts` and nowhere else.

**The launch scope is registration and data capture.** The admin table comes
later: nobody reads a registration before September 23, so it does not block
the release.

**The form is the one from `registro_xuntas.html`, field by field.** XUNTAS
already approved that shape. Changing fields or copy reopens a conversation
the calendar has no room for.

**The six-role portal (`portal_xuntas.html`) is a visual reference, not a
specification.** The `coach` and `direccion` roles are not being built this
cycle.

---

## Account first, form second

The Clerk account is created before the form is filled out. It is a XUNTAS
decision, made against advice to the contrary: a sign-up wall in front of a
conversion funnel with a fourteen-day window costs applications.

It was built as requested. The mitigation is the age gate and the draft
autosave.

---

## Three axes of state, not one enum

`users.emailVerified`, `guardianAuth.confirmedAt`, and `registrations.status`
are independent fields on purpose.

Collapsing them into a single `status` forces you to invent combined states
(`submitted_without_guardian`, `validated_without_guardian`…) that multiply
and end in a migration. Kept separate, each axis moves on its own.

---

## The age gate comes before Clerk, and the server resolves it

The call for applications says the guardian authorizes **the creation of the
account**. If the birth date were asked in the form, a minor's account would
already exist before anyone knew authorization was needed — and it cannot be
un-created.

That is why `/empezar` asks for the date first. And the answer is resolved by
the **server**: the screen sends the date to `preSignups.create`, Convex
computes `isMinor`, stores the row, and returns a token. That token — an
opaque reference, carrying no personal data — is the only thing that travels
through Clerk's `unsafeMetadata` and the only thing `sessionStorage` keeps.
The `user.created` webhook redeems it.

The first design sent the birth date and the guardian's email through
`unsafeMetadata`, which the client can rewrite whenever it wants: editing it
was enough to declare yourself of age and skip the authorization, without a
trace. Today the worst you can do is point at another pre-signup of your own,
which the server also computed.

**No date, no registration submitted.** If the signup completes without a
valid pre-signup — it happens when the token gets lost on the detour through
Google — the account is left with its age *unknown*, not *of age*.
`/mi-registro` asks for the date before showing the form, and
`registrations.submit` demands it as a backstop. Confusing "don't know" with
"is an adult" was exactly the hole.

**Unused pre-signups get deleted.** They hold the birth date of a possibly
underage person and their guardian's email before anyone has consented to
anything yet. They expire after two hours and a cron deletes them.

**The account does get created without authorization.** It stays "in
progress": the registration can be submitted, but it is flagged loudly and a
person resolves it.

**A minor is never auto-rejected for a missing authorization.** A mother or a
father not opening an email cannot cost their daughter her application.

**The form checkbox is not the consent.** A checkbox ticked by a
fifteen-year-old declaring that their guardian agrees is not consent. The
consent is the guardian's click in their own email. That is why the
prototype's `ck4` is not kept as authorization.

---

## Clerk webhook, not a lazy upsert

The user reaches Convex through the `user.created` webhook, not the first
time they make an authenticated query.

A lazy upsert leaves no trace of whoever signs up on September 5 and never
comes back — and that is exactly the list XUNTAS will want to write to before
the close.

---

## Editable until the close, then frozen

Registrations can be edited until September 18, 23:59, central Mexico time.
The window is validated on the server (`requireWindowOpen`), not just in the
UI.

The Council starts reviewing on the 23rd. If registrations kept changing
after that, they would be grading a moving target.

Mexico has not observed daylight saving time since 2022, so
`America/Mexico_City` is UTC-6 all year and the constants are stored in UTC.

---

## Email with durable execution

We use the `@convex-dev/resend` component and not the raw Resend API, because
it provides a queue, retries, and idempotency.

It matters for the guardian email: if Resend is down for five minutes, the
email goes out when it comes back instead of getting lost. And if the send is
retried, the idempotency key avoids sending the same message three times to a
parent.

`RESEND_TEST_MODE` must be switched to `false` to send to real addresses.

---

## Data

**Nested arrays** (`results`, `rankings`, `calendar`): they are small, always
read together with the registration, and Convex handles them natively.
Normalizing them would only pay off if we had to query across athletes.

**`cycle` on everything.** `registrations.cycle` and `guardianAuth.cycle`.
The call for applications runs again in 2027; a field today avoids a
migration then.

**`guardianAuth` hangs off the user, with `cycle`.** The guardian authorizes
the account, not the form — but a record is kept per cycle. It is a separate
table and not a nested field so the token can be indexed and the email link
resolved in O(1).

**`wasMinorAtSignup` is frozen.** It is not recomputed: if it were, whoever
turns 18 mid-process would stop "needing" the authorization that was already
requested, and the consent trail would be lost.

**Deletion really deletes.** `users.remove` erases the registration and the
guardian trail; it does not set a flag. If someone exercises their right of
cancellation under the LFPDPPP, their data goes away.

---

## i18n from day one

Paraglide with a route prefix (`/es/...`, `/en/...`). Spanish populated,
English empty on purpose.

The prefix goes in now because retrofitting it later forces every route to
change and breaks any link already shared. What strips and adds the prefix is
the router's `rewrite` option (`src/router.tsx`); `paraglideMiddleware` only
resolves the language and leaves it in AsyncLocalStorage. If both rewrote,
the redirects would loop.

Note: translation covers the chrome. The motivation letter, tournament names,
and clubs are the person's own content, and no library translates those.

---

## Open items that are not the provider's

1. **Privacy notice and rules.** XUNTAS is tracking them down. This is still
   a **blocker**: the routes and the links from the checkboxes already exist,
   but with the scaffolding, not the text. While `ready` is `false` in
   `src/lib/documents.ts`, the pages come out marked as drafts.
2. **Policy for when the guardian never confirms.** The recommendation is to
   hold for manual follow-up, never auto-reject. The formal decision is still
   missing.
3. **Emails that get an admin invitation.** They are added from Clerk.
4. **XUNTOS in the Shopify store.** `xuntas.org` only talks about the women's
   program. Out of scope for this work, but if it is not updated, a male
   registrant never reaches the form.

---

## Known debt

- **The VPS belongs to the provider, not XUNTAS.** Migrating later was
  agreed. Written down today so it is not discovered at handoff.
- **Convex is SaaS.** The data does not live on the Hostinger VPS but on
  convex.cloud. Relevant if anyone asks about data residency for Mexican
  minors.
- **Clerk's `esMX` localization is community-made**, not official. The
  sign-up screens have to be read before launch.

Resolved since then:

- ~~The entrypoint path in the `Dockerfile` is unverified.~~ Verified and
  fixed: `vite build` did not generate `.output` at all. `server.mjs` joins
  the two halves of `dist/` and opens the socket. See the README.
- ~~The age gate travels in `unsafeMetadata`.~~ The server now resolves it in
  `convex/preSignups.ts` and only an opaque token travels through Clerk.
