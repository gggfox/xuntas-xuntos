# Deployment — 2026–2027 call for applications

The window opens on **September 4, 2026** and closes on the **18th**. There
is no second chance: if something breaks on the 4th, it breaks with families
trying to register.

This document is the procedure and the checklist. The description of the
infrastructure (Dokploy, Traefik, which variable goes at build time and which
at runtime) is in the [`README`](../README.md#deployment).

---

## 0. How it goes to production

**The production branch is `production`, not `main`.** A push there triggers
two independent deployments:

| What | Who | How long |
| --- | --- | --- |
| Convex backend | `.github/workflows/convex-production.yml` → `npx convex deploy` | seconds |
| Container (frontend) | Dokploy's GitHub App webhook | minutes |

Both start from the same push and **nothing guarantees the order**; in
practice Convex finishes first, which is the desirable order — the new schema
lands before the new frontend queries it.

> **This deployment changes the schema** (the `preSignups` table) and adds a
> cron. Convex applies both in `convex deploy`. If for whatever reason the
> container arrived first, the app would ask for a table that does not exist
> yet. With the call for applications this close, it is worth checking that
> the Convex workflow finished green before calling the deployment good.
>
> **This release additionally needs the `cycles` row seeded**, and seeding is
> not part of `convex deploy` — it is a function someone runs by hand, once,
> after. The window lives in that table, not in the code, so between the
> Convex deploy finishing and the seed running, the app serves
> `no_active_cycle` on every registration query. That gap is expected, not a
> regression, but it means the container must not go out — and nobody should
> start the smoke test — until the seed has run.

The deploy key is fetched from Infisical (`prod` → `CONVEX_DEPLOY_KEY`)
at the start of the job with the `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`
repo secrets. If Infisical is unreachable or the key is missing, the job
fails **before** touching the branch, so Dokploy never builds against a
schema that was not deployed. See the README.

**Deploy in this order, every time:**

1. Push to `production`.
2. Wait for the `convex-production` workflow to finish green.
3. Seed the call for applications — see "Seeding the call for applications"
   below. It is idempotent, so it is safe to run again if unsure whether it
   already did.
4. Only then let the container deploy (it usually is already running by this
   point; if so, trigger a redeploy by hand in Dokploy rather than serving
   traffic against a cycle-less backend).
5. Run the smoke test in §3.

### Seeding the call for applications

The window lives in the `cycles` table, so a deployment with no row has no
window and every registration query fails with `no_active_cycle`. Seed it
once per deployment, before the frontend that reads it goes out:

```bash
npx convex run cycles:seed --prod
```

It is idempotent: `{ inserted: true, activated: true }` the first time,
`{ inserted: false, activated: false }` after. (If a different cycle is
already active when this runs — a second environment reusing the seed, or a
re-run after `create`/`setActive` moved on — it inserts 2026–2027 *inactive*
instead of dethroning whatever is active: `{ inserted: true, activated:
false }`. A `master_admin` promotes it from `/administracion/convocatorias`
when that is actually wanted.) From then on the dates are edited from
`/administracion/convocatorias` by a `master_admin`, and every change is
recorded in `cycleChanges` with who made it.

---

## 1. Dev, staging and prod are three databases

Convex separates the deployments completely: different functions, different
data, and **different environment variables**. Almost every configuration
error comes from here.

```bash
npx convex env list                        # dev
npx convex env list --deployment staging   # staging (joyous-goshawk-857)
npx convex env list --prod                 # prod   ← the one that matters on September 4
```

Every `convex env` command below carries `--prod` on purpose.

### Variables on the production deployment

`convex deploy` uploads functions, schema, and crons. **It does not upload
the environment variables**: those are set once and persist.

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://clerk.xuntas.org
npx convex env set --prod CLERK_WEBHOOK_SECRET    whsec_...
npx convex env set --prod RESEND_API_KEY          re_...
npx convex env set --prod RESEND_WEBHOOK_SECRET   whsec_...
npx convex env set --prod APP_URL                 https://app.xuntas.org
npx convex env set --prod RESEND_TEST_MODE        false
```

About two of them, the ones that fail silently:

- **`RESEND_TEST_MODE=false`.** Without this, Resend only accepts
  `@resend.dev` addresses. The guardian authorization email **reaches no
  one** and there is no visible error in the app: the registration looks
  fine and the guardian never finds out.
- **`APP_URL`.** It is the base for the links in the emails. If it is left
  pointing at `localhost`, the link the guardian receives opens nothing.

### Variables on the staging deployment

Staging is a `prod`-type deployment named `staging` inside the same Convex
project. `ci-main.yml` deploys code to it on every green `main`; the variables
are set by hand, same as prod. It runs against the **dev** Clerk instance
(`pk_test_` keys) and keeps Resend in test mode, so nobody outside
`@resend.dev` gets mail from it.

Already set (copied from dev on 2026-09-06): `CLERK_JWT_ISSUER_DOMAIN`,
`CLERK_FRONTEND_API_URL`, `RESEND_API_KEY`. (`WINDOW_ALWAYS_OPEN=true` was
copied too; it is inert now that the window lives in the `cycles` table, and
can be unset.)

Staging needs its own `cycles` row, same as prod — without one every
registration query answers `no_active_cycle`:

```bash
npx convex run cycles:seed --deployment staging
```

Still pending, because each one needs a value that only exists once the
matching thing is created in a dashboard:

```bash
# Clerk → Webhooks → new endpoint at
#   https://joyous-goshawk-857.convex.site/clerk-webhook
# with user.created, user.updated, user.deleted. Paste its signing secret:
npx convex env set --deployment staging CLERK_WEBHOOK_SECRET

# Resend → new webhook at
#   https://joyous-goshawk-857.convex.site/resend-webhook
npx convex env set --deployment staging RESEND_WEBHOOK_SECRET

# The staging frontend's URL, once Dokploy has a domain for it.
npx convex env set --deployment staging APP_URL https://<staging-domain>
```

Do **not** set `RESEND_TEST_MODE=false` on staging.

The staging frontend gets `VITE_CONVEX_URL=https://joyous-goshawk-857.convex.cloud`
from Infisical's `staging` environment at build time. If it is wrong there,
the build aborts with `VITE_CONVEX_URL must be an https:// URL` instead of
producing a container that answers 500.

### Webhooks pointing at production

The webhook URL is the **production** deployment's
(`https://<prod>.convex.site/...`), not dev's. They are different endpoints.

- **Clerk** → Webhooks → endpoint at
  `https://<prod>.convex.site/clerk-webhook` with `user.created`,
  `user.updated`, `user.deleted`.
- **Resend** → webhook at `https://<prod>.convex.site/resend-webhook` with
  the `email.*` events.

The *signing secrets* of those endpoints are the ones that go in the **prod**
`CLERK_WEBHOOK_SECRET` and `RESEND_WEBHOOK_SECRET`. The dev ones are
different.

---

## 2. The container

The details are in the README; what to remember when deploying:

- **The `VITE_*` variables come from Infisical at build time.** Dokploy only
  holds the identity's client id/secret (Build-time Secrets) and
  `INFISICAL_ENV` (Build-time Argument). To change a `VITE_*` value, change
  it in Infisical and hit Redeploy; changing anything in Dokploy without
  rebuilding does nothing. If `VITE_CONVEX_URL` or
  `VITE_CLERK_PUBLISHABLE_KEY` is missing or a placeholder, the build aborts
  with a clear message — they used to produce an image that started fine and
  answered 500 on every route.
- **The runtime secrets come from Infisical too.** `docker-entrypoint.sh`
  logs in with the machine identity at container start and runs node under
  `infisical run`, so `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`
  are in the process without Dokploy holding them. The container
  environment carries only `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`.
  If the login fails the container exits at once with the CLI's error in the
  log; if Clerk complains `Publishable key not valid`, the value in Infisical
  is wrong, not Dokploy.
- **The container comes with a `HEALTHCHECK`** on `/es/`, so Dokploy restarts
  it on its own if the SSR goes down.

---

## 3. Verification after deploying

With the image running, against the real domain:

```bash
curl -o /dev/null -w '%{http_code}\n' https://app.xuntas.org/es/
curl -o /dev/null -w '%{http_code}\n' https://app.xuntas.org/es/empezar
curl -o /dev/null -w '%{http_code}\n' https://app.xuntas.org/es/entrar
```

All three must return `200`. A `500` on all of them is usually a Clerk key
in Infisical's `prod` environment; a `502` means the container is not
starting — read its log, the entrypoint says why.

### Smoke test, end to end

Do it with a real account before the 4th, in production. It is the only way
to know the webhooks and the emails are right:

1. `/es/empezar` with an **underage birth date** and a guardian email you
   have access to.
2. Create the account. Verify the code by email.
3. The guardian email must arrive. Open it, authorize, and confirm that on
   `/es/mi-registro` the chip changes to "Tutor autorizó" ("guardian
   authorized").
4. Fill out and submit the registration. The confirmation email must arrive
   — **at the account's address**, not the one you typed into the form.
5. In the Convex dashboard (prod), the rows must exist in `users`,
   `guardianAuth`, and `registrations`, and `users.birthDate` must be set.
6. Repeat step 1 with an **of-age birth date** and confirm it does NOT ask
   for a guardian.
7. Test the signup with **Google**, not just with the email code. It is a
   different path and the only one where the pre-signup token can get lost.
   If it gets lost, the correct behavior is for `/es/mi-registro` to **ask
   for the birth date** before showing the form — not to let you through as
   an adult.

If step 3 fails and everything else works, suspect number one is
`RESEND_TEST_MODE`.

---

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

---

## 5. Checklist

Before September 4:

**Convex**
- [ ] `npx convex env list --prod` has the 6 variables from §1
- [ ] `RESEND_TEST_MODE=false` in prod
- [ ] `npx convex run cycles:seed --prod` run; the `cycles` table shows 2026-2027 active
- [ ] `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` secrets in the repo, and `CONVEX_DEPLOY_KEY` present in Infisical `prod`
- [ ] The `convex-production` workflow finished green and the `preSignups`
      table shows up in the prod dashboard
- [ ] Clerk webhook to the **prod** `.convex.site`, with the 3 events
- [ ] Resend webhook to the **prod** `.convex.site`
- [ ] `staff:grantRoles '{"email":"gerardogalangarzafox@gmail.com","roles":["master_admin"]}' --prod` run for the master_admin account
- [ ] `users:backfillRoles --prod` run (see §6)
- [ ] `users:dropLegacyRole --prod` run (see §6)

**Container**
- [ ] Infisical `prod` holds the `pk_live_` / `sk_live_` keys and the prod `VITE_CONVEX_URL`
- [ ] Dokploy production: `INFISICAL_ENV=prod` build arg; `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` as build secrets **and** as environment variables
- [ ] The three routes from §3 answer 200 on `app.xuntas.org`

**Content and code**
- [ ] Privacy notice and rules with their final text, and `ready: true` in
      `src/lib/documents.ts` (while it is `false`, both pages come out marked
      as drafts and the form says so next to the checkbox)
- [ ] `npm run check` green (typecheck + tests)
- [ ] Full smoke test, with a minor and with an adult
- [ ] Smoke test with Google in addition to the email code
- [ ] Someone from XUNTAS read Clerk's sign-up screens in Spanish

---

## 6. Release sequence for the roles migration

`users.roles` replaces the Clerk-mirrored `users.role`. Production rows
still carry `role`, so the release runs in this order — each step from the
branch commit named, never out of order:

1. Deploy the schema where `roles` is optional (commit `11f0c3c`), then
   `npx convex run users:backfillRoles --prod` and confirm `{ updated: N }`
   followed by `{ updated: 0 }` on a second run.
2. Deploy the branch head (`roles` required, `role` legacy-optional), then
   `npx convex run users:dropLegacyRole --prod` and confirm `{ updated: 0 }`
   on a second run.
3. `npx convex run staff:grantRoles '{"email":"gerardogalangarzafox@gmail.com","roles":["master_admin"]}' --prod`
   (the account must already exist in prod — sign up first).
4. Only then let the container deploy (`production` branch).

Steps 1–3 are run by hand from a local checkout of the named commits
(`git checkout 11f0c3c`, then the branch head). Do **not** trigger
`release.yml` until step 3 is confirmed: it deploys the head schema over
prod in one job, and Convex refuses that push while any row still lacks
`roles` — fail-safe, but it leaves the release half done.

`role` leaves the schema in a later PR once no row has it.
