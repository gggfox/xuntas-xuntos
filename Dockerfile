# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
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
# The domain comes from .infisical.json, copied with the code. The project
# id is read from the same file, but has to be passed explicitly: with a
# machine-identity token the CLI refuses to infer it ("Project ID is
# required when using machine identity"). vite.config.ts aborts the build
# if VITE_CONVEX_URL or VITE_CLERK_PUBLISHABLE_KEY is missing or a
# placeholder.
RUN --mount=type=secret,id=INFISICAL_CLIENT_ID \
    --mount=type=secret,id=INFISICAL_CLIENT_SECRET \
    set -eu; \
    INFISICAL_TOKEN="$(infisical login --method=universal-auth \
        --client-id "$(cat /run/secrets/INFISICAL_CLIENT_ID)" \
        --client-secret "$(cat /run/secrets/INFISICAL_CLIENT_SECRET)" \
        --plain --silent)"; \
    export INFISICAL_TOKEN; \
    project_id="$(node -p "require('./.infisical.json').workspaceId")"; \
    infisical run --env "${INFISICAL_ENV}" --projectId "${project_id}" --silent -- npm run build

# The SSR bundle leaves out react, @tanstack, @clerk, convex and a few more:
# dist/server/server.js imports them by name at runtime. Pruning here and
# copying the already-resolved tree is cheaper than a second `npm ci` in the
# runtime stage, and never touches the network again.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Unprivileged user. The container does not need root to serve SSR.
RUN addgroup -S app && adduser -S app -G app

# `vite build` leaves two halves in dist/: the SSR handler in dist/server and
# the client assets in dist/client. Both are needed — server.mjs serves the
# static files and falls back to SSR for everything else.
COPY --from=build --chown=app:app /app/dist ./dist

# No chown on purpose: the tree is huge and the `app` user only needs to read
# it. A --chown here adds a whole duplicated layer.
COPY --from=build /app/node_modules ./node_modules

# package.json is NOT optional. dist/server/server.js ends in .js, and
# without "type": "module" in the directory Node would interpret it as
# CommonJS and blow up on the first `import`.
COPY --chown=app:app package.json ./package.json
COPY --chown=app:app server.mjs ./server.mjs

USER app
EXPOSE 3000

# Dokploy restarts the container if this fails. `/es/` is the real front page
# and not a synthetic endpoint: if SSR breaks, the healthcheck finds out.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/es/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `vite build` does NOT generate a server that listens: dist/server/server.js
# exports a `fetch` handler, nothing more. server.mjs is what opens the socket.
CMD ["node", "server.mjs"]
