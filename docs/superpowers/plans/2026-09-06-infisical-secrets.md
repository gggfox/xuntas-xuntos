# Infisical Secrets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local dev, GitHub Actions and the Docker build each fetch their secrets from Infisical with one read-only machine identity, and a failed Convex deploy stops the promotion chain before the branch push that triggers Dokploy.

**Architecture:** The repo carries a committed `.infisical.json` naming the project and domain. Workflows fetch `/ci/CONVEX_DEPLOY_KEY` with `Infisical/secrets-action` before running `convex deploy`. The Dockerfile's build stage installs a pinned Infisical CLI, logs in with two BuildKit secret mounts, and runs `npm run build` under `infisical run`, so no `VITE_*` value ever passes through a build arg. A small pure module validates the build variables and is unit-tested.

**Tech Stack:** Infisical CLI 0.43.129 (apk from GitHub release, checksum-verified), `Infisical/secrets-action@v1.0.17`, Docker BuildKit secret mounts, Vitest 3.2 unit project, Convex CLI (`npm run deploy:convex`).

**Spec:** [`docs/superpowers/specs/2026-09-06-infisical-secrets-design.md`](../specs/2026-09-06-infisical-secrets-design.md)

## Global Constraints

- **Infisical instance:** `https://infisical.gggfox.com`. CLI and `.infisical.json` use `https://infisical.gggfox.com/api`; the GitHub action's `domain` input takes `https://infisical.gggfox.com` (no `/api`).
- **Project:** id `2f1b06b5-c041-4d46-ba01-4f0dd920dfe4`, slug `xuntas-xuntos-j-k6-i`. Environment slugs: `dev`, `staging`, `prod`.
- **Folders:** `/` holds app values (`VITE_*`); `/ci` holds `CONVEX_DEPLOY_KEY`. Workflows read `/ci` only.
- **Identity credentials** exist only as GitHub repo secrets `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` and Dokploy Build-time Secrets of the same names. Never in a file, an `ARG`, an `ENV`, or a log.
- **Order is enforced:** Convex deploy, then branch push, then Dokploy build. A failed Convex deploy fails the job. No "warn and skip".
- **`npm run dev` stays unchanged.** Per-developer `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` stay in `.env.local`.
- **`npm run check` green before every commit.** Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  ```
- Branch: `feat/infisical-secrets` (already exists, holds the spec). One PR to `main`.

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/build-env.ts` (new) | Pure validation of the build-time variables. Returns a list of problems; a thin `requireBuildVariables()` throws. No imports. |
| `tests/buildEnv.test.ts` (new) | Unit tests for the module above. |
| `vite.config.ts` | Drops its inline guard and calls `requireBuildVariables()` from the module. |
| `.infisical.json` (new) | Project id, default environment, domain. Committed. |
| `package.json` | Adds the `dev:secrets` script. |
| `.env.example` | Explains which values now come from Infisical and which stay local. |
| `.github/workflows/ci-main.yml` | Fetches the staging key from Infisical; hard-fails when absent. |
| `.github/workflows/release.yml` | Fetches the prod key from Infisical. |
| `.github/workflows/convex-production.yml` | Fetches the prod key from Infisical. |
| `Dockerfile` | Installs the CLI, mounts the two secrets, builds under `infisical run`. Loses the `ARG`/`ENV VITE_*` block. |
| `README.md` | Local dev via `infisical run`; deployment section rewritten around Infisical. |
| `docs/DEPLOYMENT.md` | Same, on the operational side. |

---

### Task 1: Build-variable guard as a tested module

**Files:**
- Create: `scripts/build-env.ts`
- Create: `tests/buildEnv.test.ts`
- Modify: `vite.config.ts` (the `requireBuildVariables` function and its call)

**Interfaces:**
- Produces: `buildVariableProblems(env: Record<string, string | undefined>): string[]` and `requireBuildVariables(env?: Record<string, string | undefined>): void`. Task 4's Dockerfile relies on `npm run build` aborting with these messages when a value is bad.

- [ ] **Step 1: Write the failing tests**

`tests/buildEnv.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildVariableProblems, requireBuildVariables } from '../scripts/build-env'

const good = {
  VITE_CONVEX_URL: 'https://joyous-goshawk-857.convex.cloud',
  VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
}

describe('buildVariableProblems', () => {
  it('accepts a real pair', () => {
    expect(buildVariableProblems(good)).toEqual([])
  })

  it('names every missing variable', () => {
    expect(buildVariableProblems({})).toEqual([
      'VITE_CONVEX_URL is missing',
      'VITE_CLERK_PUBLISHABLE_KEY is missing',
    ])
  })

  it('treats an empty string as missing', () => {
    expect(buildVariableProblems({ ...good, VITE_CONVEX_URL: '' })).toEqual([
      'VITE_CONVEX_URL is missing',
    ])
  })

  /**
   * The concrete regression: Dokploy built staging with a placeholder that
   * was non-empty, the old guard let it through, and the container answered
   * 500 on every route until someone read its log.
   */
  it('rejects a VITE_CONVEX_URL that is not an https URL', () => {
    expect(buildVariableProblems({ ...good, VITE_CONVEX_URL: 'REEMPLAZAR_CONVEX_URL' })).toEqual([
      'VITE_CONVEX_URL must be an https:// URL, got "REEMPLAZAR_CONVEX_URL"',
    ])
    expect(buildVariableProblems({ ...good, VITE_CONVEX_URL: 'http://x.convex.cloud' })).toEqual([
      'VITE_CONVEX_URL must be an https:// URL, got "http://x.convex.cloud"',
    ])
  })

  it('rejects a Clerk key without the pk_ prefix', () => {
    expect(buildVariableProblems({ ...good, VITE_CLERK_PUBLISHABLE_KEY: 'REEMPLAZAR' })).toEqual([
      'VITE_CLERK_PUBLISHABLE_KEY must start with pk_test_ or pk_live_',
    ])
  })

  it('ignores unrelated variables', () => {
    expect(buildVariableProblems({ ...good, CLERK_SECRET_KEY: 'sk_test_x' })).toEqual([])
  })
})

describe('requireBuildVariables', () => {
  it('is silent when everything is fine', () => {
    expect(() => requireBuildVariables(good)).not.toThrow()
  })

  it('throws one error listing every problem', () => {
    expect(() => requireBuildVariables({ VITE_CONVEX_URL: 'nope' })).toThrow(
      /VITE_CLERK_PUBLISHABLE_KEY is missing[\s\S]*VITE_CONVEX_URL must be an https:\/\/ URL/,
    )
  })

  it('points the reader at Infisical', () => {
    expect(() => requireBuildVariables({})).toThrow(/Infisical/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/buildEnv.test.ts`
Expected: FAIL — `Cannot find module '../scripts/build-env'`.

- [ ] **Step 3: Write the module**

`scripts/build-env.ts`:

```ts
/**
 * The two variables Vite has to embed into the client bundle. If either is
 * wrong there is no compile error: the image builds, the container starts,
 * and every route answers 500. So the build checks them here, where the
 * log gets read, instead of at runtime, where it does not.
 *
 * Pure on purpose: no imports, takes the environment as an argument, so it
 * can be unit-tested without touching `process.env`.
 */
export const REQUIRED_BUILD_VARIABLES = ['VITE_CONVEX_URL', 'VITE_CLERK_PUBLISHABLE_KEY'] as const

export function buildVariableProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = []

  for (const key of REQUIRED_BUILD_VARIABLES) {
    if (!env[key]) problems.push(`${key} is missing`)
  }

  const url = env.VITE_CONVEX_URL
  // Non-empty but not a URL is the placeholder case — the one that used to
  // get through.
  if (url && !/^https:\/\/\S+$/.test(url)) {
    problems.push(`VITE_CONVEX_URL must be an https:// URL, got "${url}"`)
  }

  const key = env.VITE_CLERK_PUBLISHABLE_KEY
  if (key && !/^pk_(test|live)_/.test(key)) {
    problems.push('VITE_CLERK_PUBLISHABLE_KEY must start with pk_test_ or pk_live_')
  }

  return problems
}

export function requireBuildVariables(env: Record<string, string | undefined> = process.env): void {
  const problems = buildVariableProblems(env)
  if (problems.length === 0) return
  throw new Error(
    `Build variables:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
      'The build reads them from Infisical (see README, "Deployment"). ' +
      'Locally: infisical run --env staging -- npm run build',
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/buildEnv.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Wire it into `vite.config.ts`**

Replace the whole `requireBuildVariables` function (the doc comment starting `/** Vite embeds the VITE_* variables` through the closing `}` of the function) with one import at the top of the file, after the `paraglideOptions` import:

```ts
import { requireBuildVariables } from './scripts/build-env'
```

Keep the call site exactly as it is:

```ts
const config = defineConfig(({ command }) => {
  if (command === 'build') requireBuildVariables()
```

- [ ] **Step 6: Prove the guard still fires from a real build**

Run:
```bash
VITE_CONVEX_URL=REEMPLAZAR VITE_CLERK_PUBLISHABLE_KEY=pk_test_x npm run build 2>&1 | tail -5
```
Expected: the build aborts and the output contains `VITE_CONVEX_URL must be an https:// URL, got "REEMPLAZAR"`.

- [ ] **Step 7: Full check and commit**

Run: `npm run check`
Expected: typecheck passes; all tests pass (previous 404 + 9).

```bash
git add scripts/build-env.ts tests/buildEnv.test.ts vite.config.ts
git commit -m "build: the variable guard rejects placeholders, not just blanks

A non-empty VITE_CONVEX_URL that is not an https URL built an image that
started and answered 500 on every route. The guard now lives in a pure
module with tests, and names every problem in one error.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Link the repo to Infisical for local dev

**Files:**
- Create: `.infisical.json`
- Modify: `package.json` (scripts)
- Modify: `.env.example`
- Modify: `README.md` (section "### 3. Environment variables" and "### 5. Run")

**Interfaces:**
- Produces: `.infisical.json` with `workspaceId` and `domain`. Task 4's Dockerfile relies on `COPY . .` bringing this file into the build so `infisical run` finds the project without `--projectId`.

- [ ] **Step 1: Write `.infisical.json`**

```json
{
  "workspaceId": "2f1b06b5-c041-4d46-ba01-4f0dd920dfe4",
  "defaultEnvironment": "dev",
  "domain": "https://infisical.gggfox.com/api"
}
```

- [ ] **Step 2: Check it is not ignored anywhere**

Run: `git check-ignore -v .infisical.json; grep -n infisical .dockerignore; echo "exit=$?"`
Expected: `git check-ignore` prints nothing (not ignored); the grep finds nothing (`exit=1`), so Docker's `COPY . .` includes it.

- [ ] **Step 3: Add the script**

In `package.json`, directly after the `"dev"` entry:

```json
    "dev:secrets": "infisical run -- npm run dev",
```

- [ ] **Step 4: Update `.env.example`**

Replace the two header comment lines at the top of the file:

```
# Copy to .env.local. Development only — production is configured in Dokploy
# and in Convex, see docs/DEPLOYMENT.md.
```

with:

```
# Copy to .env.local. Development only.
#
# The shared dev values (Clerk test keys, VITE_WINDOW_ALWAYS_OPEN) live in
# Infisical, project xuntas-xuntos, environment `dev`. `npm run dev:secrets`
# injects them, so with Infisical you only need the two per-developer lines
# below: CONVEX_DEPLOYMENT (written by `npx convex dev`) and VITE_CONVEX_URL.
# Without Infisical, fill everything in here by hand as before.
#
# Staging and production never read this file: the container build fetches
# its values from Infisical (see docs/DEPLOYMENT.md).
```

- [ ] **Step 5: Update the README**

In "### 3. Environment variables", replace:

```
Local ones, in `.env.local` (see [`.env.example`](.env.example)):

```
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
VITE_CONVEX_URL=
```
```

with:

```
The shared development values live in Infisical
(`https://infisical.gggfox.com`, project `xuntas-xuntos`, environment `dev`).
Install the CLI (`brew install infisical/get-cli/infisical`) and log in once
against that domain:

```bash
infisical login --domain https://infisical.gggfox.com
```

The repo is already linked ([`.infisical.json`](.infisical.json)), so nothing
else to configure. Two values are yours alone and stay in `.env.local`:

```
CONVEX_DEPLOYMENT=   # written by `npx convex dev` in step 1
VITE_CONVEX_URL=     # the URL it printed
```

Without Infisical, copy [`.env.example`](.env.example) to `.env.local` and
fill it in by hand; `npm run dev` works either way.
```

In "### 5. Run", replace:

```
```bash
npm install && npm run dev
```
```

with:

```
```bash
npm install && npm run dev:secrets   # with Infisical
npm install && npm run dev           # from .env.local only
```
```

- [ ] **Step 6: Verify the link works (human, logged in)**

Run: `infisical run --env dev -- sh -c 'echo "VITE_WINDOW_ALWAYS_OPEN=$VITE_WINDOW_ALWAYS_OPEN"'`
Expected: prints `VITE_WINDOW_ALWAYS_OPEN=true` (the value set in the `dev` environment). If it prints a warning about "Using domain from .infisical.json", that is expected.

- [ ] **Step 7: Check and commit**

Run: `npm run check`
Expected: green.

```bash
git add .infisical.json package.json .env.example README.md
git commit -m "dev: link the repo to Infisical; npm run dev:secrets

Shared dev values come from the dev environment; the two per-developer
Convex values stay in .env.local, where an injected empty value cannot
overwrite them. npm run dev is unchanged.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Workflows fetch the deploy key and fail hard

**Files:**
- Modify: `.github/workflows/ci-main.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/convex-production.yml`
- Modify: `README.md` (table under "## Deployment" listing required secrets, and the paragraph after it about generating deploy keys)
- Modify: `docs/DEPLOYMENT.md` (section "## 0. How it goes to production")

**Interfaces:**
- Consumes: repo secrets `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` (already set). Infisical `/ci/CONVEX_DEPLOY_KEY` in `staging` and `prod` (human step in Task 5).
- Produces: the environment variable `CONVEX_DEPLOY_KEY` in the job, which the Convex CLI reads by that exact name.

- [ ] **Step 1: Rewrite `ci-main.yml`**

Replace the file's contents with:

```yaml
# Promotion of `main` to `staging`.
#
# Branch flow:  main  →  staging  →  production
#
# This workflow does NOT re-run the checks: it waits for the "CI" workflow
# (ci.yml) to finish green on `main` and only then fast-forwards the branch.
# Duplicating typecheck/tests here would be slower and, worse, could drift
# from ci.yml without anyone noticing.
#
# `workflow_run` fires when CI finishes, on success or on failure — that is
# why the job's `if` checks the conclusion. Without that check it would also
# promote when the tests fail.
#
# ORDER MATTERS. Convex first, branch second. The push to `staging` is what
# makes Dokploy build the container, and the new schema has to be live
# before that container starts querying it. Every step before the push is
# therefore a gate: if the deploy key cannot be fetched or the deploy
# fails, the job fails and `staging` stays where it was.

name: main — promote to staging

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
  workflow_dispatch:

concurrency:
  group: promote-staging
  cancel-in-progress: false

jobs:
  promote:
    name: Deploy staging and fast-forward the branch
    # On workflow_dispatch there is no `workflow_run`, so promotion happens by
    # hand under the responsibility of whoever presses the button.
    if: >-
      github.event_name == 'workflow_dispatch' ||
      github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          # The exact commit that CI verified. With workflow_run the default
          # checkout points at the default branch, not at the event's commit,
          # and something other than what passed the checks would be promoted.
          ref: ${{ github.event.workflow_run.head_sha || github.ref }}
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      # The deploy key lives in Infisical, folder /ci of the `staging`
      # environment, under the exact name the Convex CLI reads. The action
      # exports it into the job environment (masked in logs) and fails the
      # job if it cannot authenticate. Only /ci is fetched: the identity can
      # read the app's secrets too, but this job has no business seeing them.
      - name: Fetch the Convex staging deploy key from Infisical
        uses: Infisical/secrets-action@v1.0.17
        with:
          method: universal
          client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
          client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
          domain: https://infisical.gggfox.com
          project-slug: xuntas-xuntos-j-k6-i
          env-slug: staging
          secret-path: /ci

      # The action succeeds even when the folder is empty. Say so here,
      # before `convex deploy` fails with a less helpful message.
      - name: The key must be there
        run: |
          if [ -z "$CONVEX_DEPLOY_KEY" ]; then
            echo "::error title=No Convex deploy key::Infisical returned no CONVEX_DEPLOY_KEY from /ci in the staging environment. Nothing was deployed and staging was not advanced."
            exit 1
          fi

      # `convex deploy` typechecks convex/ before uploading anything. The
      # key is scoped to the staging deployment (joyous-goshawk-857), so
      # this step cannot touch production by mistake.
      - name: Deploy to Convex staging
        run: npm run deploy:convex

      # Fast-forward, without --force. If `staging` diverged from `main` this
      # fails, and fails for the right reason: it means someone committed
      # straight to staging and it needs looking at, not flattening.
      - name: Fast-forward staging to main
        run: git push origin HEAD:staging
```

- [ ] **Step 2: Rewrite `release.yml`**

Replace the file's contents with:

```yaml
# Manual promotion of `staging` to `production`. This is the release button.
#
# It is triggered by hand on purpose: with `autoDeploy` turned on in Dokploy,
# everything that lands on `production` goes out to real users. During the
# call period that decision is made by a person, not by a merge.
#
# NOTE — why the Convex deploy happens inline here instead of being left to
# convex-production.yml's trigger: pushes made with GITHUB_TOKEN do not
# trigger Actions workflows (GitHub prevents it to avoid loops). The webhook
# of Dokploy's GitHub App does arrive, so the container does build on its
# own. convex-production.yml stays on as a safety net for when someone pushes
# to `production` by hand from their machine.
#
# Same order as staging, and for the same reason: Convex first, and the
# push to `production` only if the deploy succeeded.

name: release — promote staging to production

on:
  workflow_dispatch:

concurrency:
  group: release-production
  cancel-in-progress: false

jobs:
  release:
    name: Promote to production
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: staging
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Fetch the Convex production deploy key from Infisical
        uses: Infisical/secrets-action@v1.0.17
        with:
          method: universal
          client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
          client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
          domain: https://infisical.gggfox.com
          project-slug: xuntas-xuntos-j-k6-i
          env-slug: prod
          secret-path: /ci

      - name: The key must be there
        run: |
          if [ -z "$CONVEX_DEPLOY_KEY" ]; then
            echo "::error title=No Convex deploy key::Infisical returned no CONVEX_DEPLOY_KEY from /ci in the prod environment. Nothing was deployed and production was not advanced."
            exit 1
          fi

      - name: Deploy to Convex production
        run: npm run deploy:convex

      # The push to `production` is what makes Dokploy build and swap the
      # production container.
      - name: Fast-forward production to staging
        run: git push origin HEAD:production
```

- [ ] **Step 3: Rewrite `convex-production.yml`**

Replace the file's contents with:

```yaml
# Deploys the Convex backend (functions, schema, crons) to the production
# deployment when something lands on the `production` branch.
#
# Why it lives here and not in the Dockerfile: the image only carries the
# frontend. Convex is a separate backend, with its own deployment cycle —
# putting it in the container build would run it on every rebuild, even when
# not a single function changed.
#
# In the normal flow release.yml has already deployed Convex before pushing
# the branch, so this run is a no-op re-deploy of the same code. It exists
# for the other case: someone pushes to `production` from their machine and
# Dokploy starts building while nothing deployed Convex. WATCH the order in
# that case: this workflow and the Dokploy webhook start with the same push,
# and only the difference in duration (seconds versus minutes) puts the
# schema ahead of the frontend.

name: Convex — production

on:
  push:
    branches: [production]
  # Allows re-running by hand from the Actions tab if a deploy fails without
  # a new commit to push.
  workflow_dispatch:

# Two back-to-back merges must not deploy in parallel: the second one would
# wait, and the arrival order would no longer be the commit order.
concurrency:
  group: convex-production
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          # Same major as the image runtime (node:22-alpine).
          node-version: 22
          cache: npm

      # `npm ci` and not `npm install`: the lockfile rules, same as in the
      # Dockerfile.
      - run: npm ci

      - name: Fetch the Convex production deploy key from Infisical
        uses: Infisical/secrets-action@v1.0.17
        with:
          method: universal
          client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
          client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
          domain: https://infisical.gggfox.com
          project-slug: xuntas-xuntos-j-k6-i
          env-slug: prod
          secret-path: /ci

      - name: The key must be there
        run: |
          if [ -z "$CONVEX_DEPLOY_KEY" ]; then
            echo "::error title=No Convex deploy key::Infisical returned no CONVEX_DEPLOY_KEY from /ci in the prod environment."
            exit 1
          fi

      # `convex deploy` typechecks convex/ before uploading anything, so a
      # type error fails here and not halfway into production.
      - name: Deploy to Convex production
        run: npm run deploy:convex
```

- [ ] **Step 4: Validate the YAML parses**

Run:
```bash
for f in .github/workflows/ci-main.yml .github/workflows/release.yml .github/workflows/convex-production.yml; do ruby -ryaml -e "YAML.load_file('$f'); puts '$f ok'"; done
```
Expected: three `ok` lines. Then `grep -c 'CONVEX_STAGING_DEPLOY_KEY\|CONVEX_PROD_DEPLOY_KEY' .github/workflows/*.yml` prints `0` for every file: no workflow references the old secrets.

- [ ] **Step 5: Update the README's secrets table**

Under "## Deployment", find the table that starts `| Secret | For |` and replace it and the two rows below it with:

```
| Secret | For |
|---|---|
| `INFISICAL_CLIENT_ID` | the machine identity `XUNTAS-XUNTOS INFISICAL CLIENT` in Infisical, Universal Auth |
| `INFISICAL_CLIENT_SECRET` | its `github-actions` client secret |

The Convex deploy keys themselves are **not** repo secrets any more. They
live in Infisical, folder `/ci`, under the name `CONVEX_DEPLOY_KEY` in the
`staging` and `prod` environments. Each workflow fetches the one it needs
with `Infisical/secrets-action` right before `convex deploy`, and fails if
it is missing.
```

Then find the paragraph that begins `Secrets and variables → Actions), generated from the Convex dashboard with the` and the code block and line after it (`npx convex deployment token create ci-token --deployment prod` and `The staging key is the same command with --deployment staging.`), and replace that whole passage with:

```
To rotate a deploy key, generate it and store it in Infisical, not in GitHub:

```bash
npx convex deployment token create ci-token --deployment prod      # → Infisical prod    /ci/CONVEX_DEPLOY_KEY
npx convex deployment token create ci-token --deployment staging   # → Infisical staging /ci/CONVEX_DEPLOY_KEY
```
```

- [ ] **Step 6: Update `docs/DEPLOYMENT.md` section 0**

Find the line `Requires the \`CONVEX_PROD_DEPLOY_KEY\` secret in the repo. See the README.` and replace it with:

```
The deploy key is fetched from Infisical (`prod` → `/ci/CONVEX_DEPLOY_KEY`)
at the start of the job with the `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`
repo secrets. If Infisical is unreachable or the key is missing, the job
fails **before** touching the branch, so Dokploy never builds against a
schema that was not deployed. See the README.
```

- [ ] **Step 7: Check and commit**

Run: `npm run check`
Expected: green (workflows do not affect it, but the rule is every commit).

```bash
git add .github/workflows/ci-main.yml .github/workflows/release.yml .github/workflows/convex-production.yml README.md docs/DEPLOYMENT.md
git commit -m "ci: deploy keys come from Infisical, and a missing one stops the chain

Each promotion fetches /ci/CONVEX_DEPLOY_KEY for its environment with the
machine identity, right before convex deploy. The staging promotion no
longer warns and skips when the key is absent: it fails, and the branch
push that would make Dokploy build against a stale schema never happens.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The Docker build fetches its own variables

**Files:**
- Modify: `Dockerfile` (build stage only; runtime stage unchanged)
- Modify: `README.md` (the build-arg table and the paragraph above it under "## Deployment")
- Modify: `docs/DEPLOYMENT.md` (section "## 2. The container" and the staging paragraph about `VITE_CONVEX_URL`)

**Interfaces:**
- Consumes: Dokploy Build-time Secrets `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET` (already set); Build-time Argument `INFISICAL_ENV` = `staging` | `prod` (human step in Task 5). `.infisical.json` from Task 2. `requireBuildVariables()` from Task 1 running inside `npm run build`.

- [ ] **Step 1: Rewrite the build stage**

Replace everything in `Dockerfile` from `FROM node:22-alpine AS build` up to (not including) the `# ---- Runtime ----` banner with:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app

# Infisical CLI, pinned by version and verified against the release's
# checksum file. The build fetches its own VITE_* values from Infisical (see
# docs/superpowers/specs/2026-09-06-infisical-secrets-design.md): nothing
# secret is passed as --build-arg any more, so nothing secret can be stale
# in Dokploy either.
ARG INFISICAL_CLI_VERSION=0.43.129
RUN set -eu; \
    case "$(apk --print-arch)" in \
      x86_64)  arch=amd64 ;; \
      aarch64) arch=arm64 ;; \
      *) echo "unsupported architecture: $(apk --print-arch)"; exit 1 ;; \
    esac; \
    base="https://github.com/Infisical/cli/releases/download/v${INFISICAL_CLI_VERSION}"; \
    pkg="infisical_${INFISICAL_CLI_VERSION}_linux_${arch}.apk"; \
    sums="checksums.txt"; \
    wget -q "${base}/${pkg}" "${base}/${sums}"; \
    grep " ${pkg}\$" "${sums}" | sha256sum -c -; \
    apk add --no-cache --allow-untrusted "./${pkg}"; \
    rm -f "./${pkg}" "./${sums}"; \
    infisical --version

# Dependencies are copied before the code to take advantage of the layer
# cache: changing a .tsx does not reinstall node_modules.
COPY package.json package-lock.json ./
# `npm ci` follows the lockfile to the letter. Never use `npm install` here:
# the production versions have to be the same ones you tested.
RUN npm ci

COPY . .

# The ONE build argument, and it is not a secret: which Infisical
# environment to build against. Dokploy sets it per environment.
ARG INFISICAL_ENV
RUN test -n "${INFISICAL_ENV:-}" || { echo "INFISICAL_ENV build arg is required: staging | prod"; exit 1; }

# Everything that starts with VITE_ has to exist HERE, at build time: Vite
# embeds it into the client bundle. A runtime variable is useless — the
# bundle was already compiled with the old value (or with undefined). That
# is why staging and production need separate builds even when the commit
# is the same.
#
# The two identity credentials are BuildKit secret mounts. They exist as
# files inside this RUN only — never in an ARG, an ENV, or a layer, so
# `docker history` shows nothing. `infisical run` injects the project's
# `/` folder into the build's environment; Vite embeds only the VITE_*
# variables, so anything else in there stays out of the bundle.
#
# The domain and project id come from .infisical.json, copied with the
# code. vite.config.ts aborts the build if VITE_CONVEX_URL or
# VITE_CLERK_PUBLISHABLE_KEY is missing or a placeholder.
RUN --mount=type=secret,id=INFISICAL_CLIENT_ID \
    --mount=type=secret,id=INFISICAL_CLIENT_SECRET \
    set -eu; \
    INFISICAL_TOKEN="$(infisical login --method=universal-auth \
        --client-id "$(cat /run/secrets/INFISICAL_CLIENT_ID)" \
        --client-secret "$(cat /run/secrets/INFISICAL_CLIENT_SECRET)" \
        --plain --silent)"; \
    export INFISICAL_TOKEN; \
    infisical run --env "${INFISICAL_ENV}" --silent -- npm run build

# The SSR bundle leaves out react, @tanstack, @clerk, convex and a few more:
# dist/server/server.js imports them by name at runtime. Pruning here and
# copying the already-resolved tree is cheaper than a second `npm ci` in the
# runtime stage, and never touches the network again.
RUN npm prune --omit=dev

```

The runtime stage below the banner is untouched. The old `ARG VITE_*` /
`ENV VITE_*` block and the comment about `CLERK_SECRET_KEY` not going in an
`ARG` are gone with the replaced section (the point still holds and is now
true of every secret, which the new comment says).

- [ ] **Step 2: Lint the Dockerfile shape**

Run:
```bash
grep -n 'ARG\|ENV\|mount=type=secret' Dockerfile
```
Expected: exactly `ARG INFISICAL_CLI_VERSION`, `ARG INFISICAL_ENV`, the two `--mount=type=secret` lines, and in the runtime stage only `ENV NODE_ENV=production` and `ENV PORT=3000`. No `VITE_` anywhere in `ARG`/`ENV` lines.

- [ ] **Step 3: Negative build (no credentials needed)**

Run:
```bash
docker build --target build --build-arg INFISICAL_ENV=staging \
  --secret id=INFISICAL_CLIENT_ID,src=/dev/null \
  --secret id=INFISICAL_CLIENT_SECRET,src=/dev/null . 2>&1 | tail -8
```
Expected: the CLI installs (you see `infisical --version` output in the log, `0.43.129`), and the login step fails with `unable to authenticate with universal auth` mentioning the domain `https://infisical.gggfox.com`. That proves the install, the checksum, the secret mounts and the domain resolution, without a real credential.

- [ ] **Step 4: Positive build (human — has the identity's credentials in the shell)**

Run, with `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` exported in the shell:
```bash
docker build --build-arg INFISICAL_ENV=staging \
  --secret id=INFISICAL_CLIENT_ID,env=INFISICAL_CLIENT_ID \
  --secret id=INFISICAL_CLIENT_SECRET,env=INFISICAL_CLIENT_SECRET \
  -t xuntas-staging-local . 2>&1 | tail -15
docker history xuntas-staging-local | grep -ci 'infisical_client\|pk_test\|convex.cloud' || echo "no secrets in history"
```
Expected: `vite build` completes; the history grep prints `no secrets in history`.

- [ ] **Step 5: Update the README deployment section**

Find the paragraph beginning `**Everything that starts with \`VITE_\` is a build arg, not a runtime variable.**` and the table that follows it (through the row for `CLERK_JWT_ISSUER_DOMAIN, ...`) and the paragraph after the table beginning `In Dokploy the build args live in each service's`. Replace all of it with:

```
**Everything that starts with `VITE_` is embedded at build time.** Vite bakes
it into the client bundle, so it cannot be a runtime variable, and staging
and production have to be built separately even from the same commit.

Those values are **not** configured in Dokploy. The Dockerfile's build stage
logs in to Infisical with a machine identity and runs `vite build` under
`infisical run`, which injects the project's `/` folder for the chosen
environment. Dokploy provides three things per environment:

| Kind | Name | Value |
|---|---|---|
| Build-time Secret | `INFISICAL_CLIENT_ID` | the identity's client id |
| Build-time Secret | `INFISICAL_CLIENT_SECRET` | its `dokploy-build` client secret |
| Build-time Argument | `INFISICAL_ENV` | `staging` or `prod` |

Build-time Secrets are BuildKit secret mounts: they never appear in an
`ARG`, an `ENV`, a layer, or `docker history`.

The container's **runtime** variables stay in Dokploy's Environment
Settings, because fetching two values at every restart is not worth a
dependency on Infisical:

| Variable | Why runtime |
|---|---|
| `CLERK_SECRET_KEY` | Clerk's SSR middleware reads it from `process.env` |
| `CLERK_PUBLISHABLE_KEY` | same, **without** the `VITE_` prefix; same value as `VITE_CLERK_PUBLISHABLE_KEY` in Infisical |

And `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`, `RESEND_API_KEY`,
`APP_URL` live in Convex (`npx convex env set`) — they don't go through
Docker at all.

Trade-off to know about: Infisical runs on the same VPS. If its container
is down, no frontend build can run until it is back. Running containers
keep serving; Convex deploys from GitHub are unaffected.
```

- [ ] **Step 6: Update `docs/DEPLOYMENT.md`**

In "### Variables on the staging deployment", replace the paragraph:

```
The Dokploy `staging` environment must build with
`VITE_CONVEX_URL=https://joyous-goshawk-857.convex.cloud` (a build arg — see
the README) or the staging frontend will talk to the wrong backend.
```

with:

```
The staging frontend gets `VITE_CONVEX_URL=https://joyous-goshawk-857.convex.cloud`
from Infisical's `staging` environment at build time. If it is wrong there,
the build aborts with `VITE_CONVEX_URL must be an https:// URL` instead of
producing a container that answers 500.
```

In "## 2. The container", replace the first bullet (the one starting
`**The \`VITE_*\` variables are build args.**`) with:

```
- **The `VITE_*` variables come from Infisical at build time.** Dokploy only
  holds the identity's client id/secret (Build-time Secrets) and
  `INFISICAL_ENV` (Build-time Argument). To change a `VITE_*` value, change
  it in Infisical and hit Redeploy; changing anything in Dokploy without
  rebuilding does nothing. If `VITE_CONVEX_URL` or
  `VITE_CLERK_PUBLISHABLE_KEY` is missing or a placeholder, the build aborts
  with a clear message — they used to produce an image that started fine and
  answered 500 on every route.
```

- [ ] **Step 7: Check and commit**

Run: `npm run check`
Expected: green.

```bash
git add Dockerfile README.md docs/DEPLOYMENT.md
git commit -m "build: the image fetches its VITE_* values from Infisical

The build stage installs a pinned, checksum-verified Infisical CLI, logs in
with two BuildKit secret mounts, and runs vite build under infisical run.
Dokploy no longer holds any VITE_* build arg, so it cannot hold a stale one.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Pull request and cutover

**Files:** none in the repo. This task is the PR plus the human steps in Infisical, Dokploy and GitHub, in the order that keeps everything working at each point.

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin feat/infisical-secrets
gh pr create --base main --title "feat(secrets): Infisical is the single source for dev, CI and the image" --body-file - <<'EOF'
## Summary

Infisical (`infisical.gggfox.com`, project `xuntas-xuntos`) holds every secret once. Three consumers fetch with one read-only machine identity:

- **Local dev**: `.infisical.json` links the repo; `npm run dev:secrets` injects the `dev` environment. `npm run dev` unchanged; per-developer Convex values stay in `.env.local`.
- **GitHub Actions**: `ci-main.yml`, `release.yml`, `convex-production.yml` fetch `/ci/CONVEX_DEPLOY_KEY` with `Infisical/secrets-action` before `convex deploy`. A missing key or failed deploy **fails the job before the branch push**, so Dokploy never builds against an undeployed schema. The staging promotion's "warn and skip" is gone.
- **Docker build**: pinned, checksum-verified Infisical CLI; two BuildKit secret mounts; `vite build` under `infisical run`. No `VITE_*` build args in Dokploy any more.

Also: the build-variable guard moved to `scripts/build-env.ts` with tests, and now rejects placeholders (a non-https `VITE_CONVEX_URL`), which is what built today's 502 staging container.

Spec: `docs/superpowers/specs/2026-09-06-infisical-secrets-design.md`. Plan: `docs/superpowers/plans/2026-09-06-infisical-secrets.md`.

## Cutover (in this order)

Merging alone breaks nothing: the old repo secrets still exist and Dokploy still builds with its old args until step 3.

1. Infisical: identity → Viewer; `/ci/CONVEX_DEPLOY_KEY` in `staging` and `prod`; delete the stray `dev` entries.
2. Merge. Run `ci-main.yml` by hand and confirm the Infisical step, the deploy, and the fast-forward.
3. Dokploy, both environments: add `INFISICAL_ENV`; remove the seven `VITE_*` build args; redeploy staging; confirm `https://staging.app.xuntas.org/es/` answers 200.
4. GitHub: delete `CONVEX_PROD_DEPLOY_KEY` and `CONVEX_STAGING_DEPLOY_KEY`.

## Test plan

- [x] `npm run check` green (9 new unit tests)
- [x] Negative Docker build fails at Infisical login, proving install + checksum + secret mounts
- [ ] Positive Docker build with real credentials; `docker history` shows no secret
- [ ] Manual `ci-main.yml` run green with the Infisical step
- [ ] Staging redeploy from Dokploy answers 200 over HTTPS

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 2: Infisical (human)**

1. Project → Access Control → Machine Identities → `XUNTAS-XUNTOS INFISICAL CLIENT` → Edit Roles → `Viewer`.
2. Secrets → environment `staging` → Add Folder `ci` → inside it, Add Secret `CONVEX_DEPLOY_KEY` with the staging key's value. Delete the old root-level `CONVEX_STAGING_DEPLOY_KEY`.
3. Same in `prod`: folder `ci`, secret `CONVEX_DEPLOY_KEY` with the production key. Delete the root-level `CONVEX_DEPLOY_KEY`.
4. In `dev`: delete `CONVEX_PROD_DEPLOY_KEY` and the empty `VITE_CONVEX_URL`.

- [ ] **Step 3: Merge, then prove CI**

After merge:
```bash
gh workflow run ci-main.yml --ref main
sleep 20; gh run list --workflow=ci-main.yml --limit 1
```
Then `gh run watch <id> --exit-status` and confirm in `gh run view <id> --log` that "Fetch the Convex staging deploy key from Infisical" ran, "Deploy to Convex staging" printed `✔ Deployed Convex functions to https://joyous-goshawk-857.convex.cloud`, and the fast-forward ran.

- [ ] **Step 4: Dokploy (human)**

For the `staging` environment's `frontend` service, Environment tab: add Build-time Argument `INFISICAL_ENV=staging`; delete the seven `VITE_*` lines from Build-time Arguments (leave the two runtime `CLERK_*` lines in Environment Settings alone). Save. Same for `production` with `INFISICAL_ENV=prod`. Then Deploy on staging.

Verify:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://staging.app.xuntas.org/es/
```
Expected: `200`.

- [ ] **Step 5: GitHub (human)**

```bash
gh secret delete CONVEX_PROD_DEPLOY_KEY
gh secret delete CONVEX_STAGING_DEPLOY_KEY
gh secret list
```
Expected: only `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` remain.
