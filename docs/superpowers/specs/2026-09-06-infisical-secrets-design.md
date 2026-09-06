# Infisical as the source of secrets — design

**Date:** 2026-09-06
**Status:** approved in chat, pending review of this document
**Instance:** `https://infisical.gggfox.com` (self-hosted, v0.162.2, on the same Dokploy VPS)
**Project:** `xuntas-xuntos`, slug `xuntas-xuntos-j-k6-i`, environments `dev`, `staging`, `prod`

## Problem

Three places hold copies of the same values by hand: `.env.local` on each
machine, the repo's GitHub Actions secrets, and the Dokploy environment
variables. Nothing keeps them in step. On 2026-09-06 the staging container
was built with a placeholder `VITE_CONVEX_URL`, passed the build guard
(which only checks the variable is non-empty), and answered 502 through
the health check until someone read the container log.

## Goal

Infisical holds every secret once. The three consumers fetch what they need
at the moment they need it, with a machine identity, and fail loudly when
they cannot.

Out of scope, on purpose:

- **Container runtime variables** (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`)
  stay in Dokploy's environment. Fetching them at container start would make
  every restart depend on Infisical, for two values.
- **Convex deployment variables** (`CLERK_JWT_ISSUER_DOMAIN`, `RESEND_API_KEY`,
  `APP_URL`, …) stay in Convex, set with `npx convex env set`.
- **Secret Syncs** (Infisical pushing into GitHub). Rejected: needs a GitHub
  App registered against the self-hosted server. Pull-at-run-time needs only
  an identity.

## Identity

One machine identity, `XUNTAS-XUNTOS INFISICAL CLIENT`, Universal Auth,
project role **Viewer** (read-only; it is `Member` today and must be
downgraded). Two client secrets under it, `github-actions` and
`dokploy-build`, so either consumer can be revoked alone.

Its client id and secret live in exactly two places:

| Where | Names |
|---|---|
| GitHub → repo secrets | `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` |
| Dokploy → each environment → Build-time Secrets | `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` |

## Layout in Infisical

```
/                      one flat folder per environment
  VITE_CONVEX_URL
  VITE_CLERK_PUBLISHABLE_KEY
  VITE_WINDOW_ALWAYS_OPEN      (staging and development only — never production)
  CLERK_SECRET_KEY             (reference copy; Dokploy still holds its own)
  CONVEX_DEPLOY_KEY            (staging: the staging key; prod: the prod key)
```

Changes to today's state:

- **Rename** staging `CONVEX_STAGING_DEPLOY_KEY` → `CONVEX_DEPLOY_KEY`. The
  name is the exact variable the Convex CLI reads, so the workflow needs no
  mapping step.
- **Delete** `CONVEX_PROD_DEPLOY_KEY` from the development environment. A
  production key in the development column is a mistake waiting to be
  exported into someone's shell.
- **Delete** the empty `VITE_CONVEX_URL` from development. Per-developer
  values do not belong in a shared environment (see "Local dev").
- No folders. The action fetches the whole environment, so the CI job's
  environment also carries `CLERK_SECRET_KEY` and the `VITE_*` values,
  masked in logs and unused. Accepted for simplicity over a `/ci` folder.
- **Not stored anywhere:** the four `VITE_CLERK_SIGN_*` variables the old
  Dockerfile carried. `SignInScreen` and `SignUpScreen` pass `signInUrl`,
  `signUpUrl` and `forceRedirectUrl` as props, nothing in the app triggers a
  Clerk-driven redirect that would fall back to the env values, and Clerk's
  TanStack Start package does not read the two `FALLBACK_REDIRECT` names at
  all. They were dead config.

## Consumer 1 — local dev

- `.infisical.json` is committed:

  ```json
  {
    "workspaceId": "<project id — to confirm>",
    "defaultEnvironment": "dev",
    "domain": "https://infisical.gggfox.com"
  }
  ```

  None of it is secret. The `domain` field means nobody has to pass
  `--domain` or log in twice.

- `npm run dev` is **unchanged**. A new script, `npm run dev:secrets`, is
  `infisical run -- npm run dev`. The README names it as the preferred path
  and keeps the manual `.env.local` path as the fallback.

- **Per-developer values stay in `.env.local`:** `CONVEX_DEPLOYMENT` and
  `VITE_CONVEX_URL`. Each developer has their own Convex dev deployment, so
  these cannot be shared. The trap this avoids: Vite lets the process
  environment win over `.env.local`, so an *empty* `VITE_CONVEX_URL`
  injected by `infisical run` would silently blank the real one.

## Consumer 2 — GitHub Actions

Every workflow that deploys Convex gains one step before the deploy, using
the official action:

```yaml
- uses: Infisical/secrets-action@v1.0.12
  with:
    method: universal
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    domain: https://infisical.gggfox.com
    project-slug: xuntas-xuntos-j-k6-i
    env-slug: staging          # or prod
```

It exports `CONVEX_DEPLOY_KEY` into the job environment, masked in logs.
The step **fails the job** if authentication fails or the project is not
found, which is the behaviour we want.

| Workflow | env-slug | What changes |
|---|---|---|
| `ci-main.yml` | `staging` | The "secret missing → warn and skip" branch is **removed**. If the key cannot be fetched or the deploy fails, the job fails and `staging` is not advanced. The Dokploy webhook therefore never fires against a stale schema. |
| `release.yml` | `prod` | Same shape. The push to `production` only happens after Convex production deployed. |
| `convex-production.yml` | `prod` | Same fetch step. Still the safety net for a hand push. |

Order is unchanged and now enforced: **Convex first, branch push second,
container build third (Dokploy, on the push).** A failed Convex deploy stops
the chain before step two.

The old `CONVEX_PROD_DEPLOY_KEY` and `CONVEX_STAGING_DEPLOY_KEY` repo secrets
are deleted once the new workflows have run green once.

## Consumer 3 — the Docker build

Dokploy, per environment:

| Kind | Name | Value |
|---|---|---|
| Build-time Secret | `INFISICAL_CLIENT_ID` | identity client id |
| Build-time Secret | `INFISICAL_CLIENT_SECRET` | the `dokploy-build` client secret |
| Build-time Argument | `INFISICAL_ENV` | `staging` or `prod` |

The seven `VITE_*` build args are **removed** from Dokploy. Their values
come from Infisical from now on, so Dokploy can no longer hold a stale copy.

Dockerfile build stage:

```dockerfile
# Infisical CLI, from its apk repo, pinned.
RUN wget -qO- https://artifacts-cli.infisical.com/setup.apk.sh | sh \
 && apk add --no-cache infisical=<version>

ARG INFISICAL_ENV
# The two credentials are BuildKit secret mounts: they exist only inside this
# RUN, never in an ARG, an ENV, or a layer. `docker history` shows nothing.
RUN --mount=type=secret,id=INFISICAL_CLIENT_ID \
    --mount=type=secret,id=INFISICAL_CLIENT_SECRET \
    INFISICAL_TOKEN="$(infisical login --method=universal-auth \
        --client-id "$(cat /run/secrets/INFISICAL_CLIENT_ID)" \
        --client-secret "$(cat /run/secrets/INFISICAL_CLIENT_SECRET)" \
        --plain --silent)" \
    infisical run --env "$INFISICAL_ENV" --path / -- npm run build
```

- `infisical run` injects the `/` folder into the build's environment. Vite
  embeds only `VITE_*`-prefixed variables, so `CLERK_SECRET_KEY` being in
  that environment does not reach the bundle.
- The existing guard in `vite.config.ts` still aborts the build if
  `VITE_CONVEX_URL` or `VITE_CLERK_PUBLISHABLE_KEY` is missing. It gains a
  second check: `VITE_CONVEX_URL` must start with `https://`, so a
  placeholder can never again produce an image that boots and 500s.
- The `ARG VITE_*` / `ENV VITE_*` block is deleted from the Dockerfile.
- Domain and project id come from `.infisical.json`, which `COPY . .`
  brings into the build context.

Building locally for a smoke test:

```bash
docker build --build-arg INFISICAL_ENV=staging \
  --secret id=INFISICAL_CLIENT_ID,env=INFISICAL_CLIENT_ID \
  --secret id=INFISICAL_CLIENT_SECRET,env=INFISICAL_CLIENT_SECRET .
```

**Accepted trade-off:** Infisical runs on the same VPS as the builds. If its
container is down, no frontend build can run until it is back. Convex
deploys from GitHub are unaffected. Production keeps serving; only new
builds wait.

## Cutover

1. **Infisical** (human): downgrade the identity to Viewer; create the two
   client secrets; put `CONVEX_DEPLOY_KEY` in staging and prod; delete the two
   stray development entries. *Done as of this writing: client secrets
   created; GitHub and Dokploy hold them.*
2. **Repo** (this branch): `.infisical.json`, `dev:secrets` script, the
   three workflows, the Dockerfile, the `vite.config.ts` URL check, README
   and `docs/DEPLOYMENT.md`. Merging this alone breaks nothing: the old
   repo secrets are still present until step 4, and Dokploy still builds
   with its old build args until step 3.
3. **Dokploy** (human): add `INFISICAL_ENV` and remove the `VITE_*` build
   args on both environments; redeploy staging. This is also what fixes the
   current staging 502.
4. **GitHub** (human): delete `CONVEX_PROD_DEPLOY_KEY` and
   `CONVEX_STAGING_DEPLOY_KEY` after one green promotion run.

## Verification

- `npm run check` green on the branch.
- A manual `workflow_dispatch` of `ci-main.yml` shows the Infisical step,
  then a successful Convex staging deploy, then the fast-forward.
- Staging Dokploy build log shows the login and `npm run build` succeeding
  with no `VITE_*` in the build args; `https://staging.app.xuntas.org/es/`
  answers 200.
- Negative check: temporarily point `INFISICAL_ENV` at a nonexistent slug
  and confirm the build fails at the guard, not at runtime.
