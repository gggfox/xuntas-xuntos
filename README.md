# xuntas-xuntos

Registration for the 2026–2027 General Call (Convocatoria General) of the
XUNTAS+XUNTOS Development Program.

**Window:** September 4–18, 2026 · **Target:** `app.xuntas.org`

Stack: TanStack Start · Convex · Clerk · Resend · Paraglide · Tailwind v4

- Decisions and the why behind them → [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Brand rules → [`docs/BRAND.md`](docs/BRAND.md)
- DNS for `xuntas.org` → [`DNS-NOTES.md`](DNS-NOTES.md)

---

## Getting started

Steps 1 and 2 are interactive and have to be run once. Without them
`convex/_generated/` does not exist and the project does not compile.

### 1. Convex

```bash
npx convex dev
```

Create the project **under a XUNTAS account**, not a personal one. It generates
`convex/_generated/` and writes `CONVEX_DEPLOYMENT` to `.env.local`. Copy the
URL it prints into `VITE_CONVEX_URL` in `.env.local`.

Leave it running in a terminal while you develop: it hot-syncs functions and
schema.

### 2. Clerk

In the Clerk dashboard:

1. **API keys → copy the _Frontend API URL_.** That is the value of
   `CLERK_JWT_ISSUER_DOMAIN`.
   Dev: `https://<slug>.clerk.accounts.dev` · Prod: `https://clerk.xuntas.org`.
   Trick: the host is base64-encoded inside the publishable key itself, after
   the `pk_test_` / `pk_live_` prefix.
2. **Integrations → turn on Convex.** This is not optional, and the issuer URL
   above does not stand in for it. The integration is what adds `aud: "convex"`
   to the session token, which is the claim `applicationID: 'convex'` in
   [`convex/auth.config.ts`](convex/auth.config.ts) checks.
   With it off, `ConvexProviderWithClerk` falls back to asking for a JWT
   template named `convex`; when that does not exist either, it swallows the
   error and every query runs unauthenticated — `mi-registro` then sits on
   "preparing your account" forever, for an account that already exists.
   (The old Convex *JWT template* is the alternative to this, not a second
   thing to set up. One or the other, and the integration is the current one.)
3. **User & authentication → Email**: leave *Email verification code* on and
   turn off *Email verification link*. In the **Password** tab, turn passwords
   off. Under **SSO connections**, enable Google.
4. **Webhooks → new endpoint** pointing to
   `https://<your-deployment>.convex.site/clerk-webhook`, with the events
   `user.created`, `user.updated` and `user.deleted`. Copy the *Signing Secret*.

### 3. Environment variables

Local ones, in `.env.local` (see [`.env.example`](.env.example)):

```
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
VITE_CONVEX_URL=
```

In Convex, which is where the backend runs:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<slug>.clerk.accounts.dev
npx convex env set CLERK_WEBHOOK_SECRET whsec_...
npx convex env set RESEND_API_KEY re_...
npx convex env set APP_URL http://localhost:3000
```

> **`npx convex env set` writes to the DEVELOPMENT deployment.** Production is
> a separate deployment, with its own variables and its own database. To touch
> production you have to add `--prod` to every command. See
> [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
>
> `RESEND_TEST_MODE` stays unset in development: that way Resend only accepts
> `@resend.dev` addresses and nobody gets email by accident.

### 4. Resend

The domain is already verified (see `DNS-NOTES.md`). What's missing is the
delivery-status webhook: point one at
`https://<your-deployment>.convex.site/resend-webhook` with all the `email.*`
events, and save the secret:

```bash
npx convex env set RESEND_WEBHOOK_SECRET whsec_...
```

### 5. Run

```bash
npm install && npm run dev
```

---

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

---

## Deployment

Docker on Hostinger + Dokploy. The Dokploy project is `xuntas-xuntos`, with
two environments — `staging` and `production` — and a `frontend` service in
each. `app.xuntas.org` points at the VPS via an A record (see `DNS-NOTES.md`).

**Everything that starts with `VITE_` is a build arg, not a runtime variable.**
Vite embeds them in the client bundle during the build, so changing the value
in Dokploy does nothing until you rebuild. It is also the reason staging and
production have to be built separately even though they come from the same
commit.

| Variable | Where it goes | Why |
|---|---|---|
| `VITE_CONVEX_URL` | build arg | ends up in the bundle |
| `VITE_CLERK_PUBLISHABLE_KEY` | build arg | ends up in the bundle |
| `VITE_CLERK_SIGN_IN_URL` | build arg | same |
| `VITE_CLERK_SIGN_UP_URL` | build arg | same |
| `VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | build arg | same |
| `VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | build arg | same |
| `CLERK_SECRET_KEY` | runtime | an `ARG` ends up in `docker history` |
| `CLERK_PUBLISHABLE_KEY` | runtime | Clerk's SSR reads it from `process.env`, **without** the `VITE_` prefix. Same value as the one above |
| `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`, `RESEND_API_KEY`, `APP_URL` | Convex | `npx convex env set` — they don't go through Docker |

In Dokploy the build args live in each service's **Environment → Build Time
Arguments** tab, and point at the environment's variables with
`${{environment.NAME}}`, so secrets are not repeated in every service.

The full procedure — deployment order, the `--prod` trap with the Convex
variables, smoke test and the checklist to go through before September 4 — is
in **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**.

To reproduce the build by hand:

```bash
# 1. Backend
npx convex deploy            # or: npm run deploy:convex

# 2. Image — VITE_* are build args: Vite embeds them in the client bundle
docker build \
  --build-arg VITE_CONVEX_URL=https://xxx.convex.cloud \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx \
  --build-arg VITE_CLERK_SIGN_IN_URL=/es/entrar \
  --build-arg VITE_CLERK_SIGN_UP_URL=/es/empezar \
  --build-arg VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/es/mi-registro \
  --build-arg VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/es/mi-registro \
  -t xuntas-registro .
```

### CI/CD

Three branches, in a chain:

```
main  --(checks + Convex staging)-->  staging  --(manual release)-->  production
```

| Workflow | When | What it does |
|---|---|---|
| `ci.yml` | push and PR | typecheck, tests and build — the quality gate |
| `ci-main.yml` | when `ci.yml` finishes green on `main` | deploys Convex staging and advances the `staging` branch |
| `release.yml` | **by hand** (Actions → Run workflow) | deploys Convex production and advances `production` to `staging` |
| `convex-production.yml` | push to `production` | safety net: deploys Convex if someone pushes to `production` from their machine |

No workflow builds the container: every push to `staging` or `production`
reaches Dokploy through its GitHub App webhook, and Dokploy builds the image
on the VPS.

`ci-main.yml` does not repeat the checks: it hooks into `ci.yml` via
`workflow_run` and only promotes if it finished green. Duplicating them would
be slower and could drift from `ci.yml` without anyone noticing.

In both hops Convex goes **before** the branch, so the new schema is up before
the new frontend queries it.

`release.yml` is manual on purpose: with `autoDeploy` on, everything that
lands on `production` goes out to real users. During the call, that decision
is made by a person.

> **Why the Convex deploy lives inside each workflow instead of being
> chained.** Pushes made with `GITHUB_TOKEN` do not trigger Actions workflows
> — GitHub blocks that to prevent infinite loops. The webhook from Dokploy's
> GitHub App does arrive, so the container does build on its own.

Required secrets (Settings → Secrets and variables → Actions):

| Secret | For |
|---|---|
| `CONVEX_PROD_DEPLOY_KEY` | `release.yml` and `convex-production.yml` |
| `CONVEX_STAGING_DEPLOY_KEY` | `ci-main.yml` — **does not exist yet**; while it's missing, the Convex staging step is skipped with a warning and the chain goes on |

A merge to `production` triggers **two** independent deployments:

| What | Who triggers it | What it does |
|---|---|---|
| Container (frontend) | Dokploy's GitHub App webhook | clones `production` on the VPS, builds the Dockerfile with the environment's build args and swaps the container |
| Convex backend | `.github/workflows/convex-production.yml` | `npx convex deploy` — functions, schema and crons |

Convex goes in GitHub Actions and not inside the Dockerfile on purpose: it is
a separate backend, and putting it in the build would run it on every rebuild
even if not a single function changed.

Both start from the same push. Convex usually finishes first — seconds against
the minutes of the Docker build — which is the desirable order: the new schema
up before the new frontend queries it. **Nothing guarantees it** other than
that difference in duration.

It requires the `CONVEX_PROD_DEPLOY_KEY` secret in the repo (Settings →
Secrets and variables → Actions), generated from the Convex dashboard with the
`deployment:deploy` permission, or with:

```bash
npx convex deployment token create ci-token --deployment prod
```

The variables that live in Convex (`CLERK_JWT_ISSUER_DOMAIN`,
`CLERK_WEBHOOK_SECRET`, `RESEND_API_KEY`, `APP_URL`) are **not** deployed by
this workflow: they are set once with `npx convex env set` and persist in the
deployment.

### How the container starts

`vite build` does **not** produce a server that listens on a port. It leaves
two halves in `dist/`:

- `dist/server/server.js` — a web-style `fetch` handler, no socket.
- `dist/client/` — the static assets.

`server.mjs` is what joins them and opens the port, using `srvx` (the same
library `vite preview` uses under the hood): it serves `dist/client` as
middleware and falls back to SSR for everything else.

The SSR bundle is **not** self-contained — it imports `react`, `@tanstack`,
`@clerk`, `convex` and a few others by name. That is why the image ships
`node_modules` pruned with `npm prune --omit=dev`, and `package.json` (without
`"type": "module"` Node would read `dist/server/server.js` as CommonJS).

The container ships a `HEALTHCHECK` on `/es/`, so Dokploy restarts it on its
own if the SSR goes down.

---

## Structure

```
convex/                 backend
  schema.ts             tables and indexes — the three axes of state
  preSignups.ts         age gate resolved on the server
  users.ts              Clerk mirror, user creation, age declaration, roles
  guardian.ts           guardian authorization via token
  registrations.ts      draft, submission, validation
  emails.ts             templates and durable sending
  http.ts               Clerk and Resend webhooks
  crons.ts              sweep of expired pre-signups
  lib/cycle.ts          call dates — single source of truth
  lib/html.ts           escaping for the email templates

src/
  routes/               / · /empezar · /crear-cuenta · /entrar
                        /mi-registro · /autorizar/$token
                        /aviso-de-privacidad · /bases
  components/           AppBar, RegistrationForm, Clerk and error screens
  lib/                  form, preSignup, documents, clerkAppearance, cycle, convex
  styles.css            @theme — single source of the visual system

server.mjs              production entry point: static files + SSR
tests/                  pure-logic tests (vitest): cycle, form, html

messages/es.json        all the text, in Spanish
messages/en.json        empty on purpose
```
