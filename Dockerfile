# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies are copied before the code to take advantage of the layer
# cache: changing a .tsx does not reinstall node_modules.
COPY package.json package-lock.json ./
# `npm ci` follows the lockfile to the letter. Never use `npm install` here:
# the production versions have to be the same ones you tested.
RUN npm ci

COPY . .

# Everything that starts with VITE_ has to exist HERE, at build time: Vite
# embeds it into the client bundle. Passing it as a runtime variable is
# useless — the bundle was already compiled with the old value (or with
# undefined). They are passed with --build-arg; in Dokploy they are the
# "Build Time Arguments" of each environment, which is why staging and
# production need separate builds even when the commit is the same.
#
# CLERK_SECRET_KEY does NOT go here. It is a runtime value, and an ARG stays
# written in the image history: `docker history` would show it to anyone who
# could pull the image.
ARG VITE_CONVEX_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_SIGN_IN_URL
ARG VITE_CLERK_SIGN_UP_URL
ARG VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
ARG VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL

# Development escape hatch. No default value on purpose: if it is not passed,
# it stays empty and the registration window follows the calendar. See
# convex/lib/cycle.ts — NEVER set it to 'true' in production.
ARG VITE_WINDOW_ALWAYS_OPEN

ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_SIGN_IN_URL=$VITE_CLERK_SIGN_IN_URL
ENV VITE_CLERK_SIGN_UP_URL=$VITE_CLERK_SIGN_UP_URL
ENV VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=$VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
ENV VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=$VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
ENV VITE_WINDOW_ALWAYS_OPEN=$VITE_WINDOW_ALWAYS_OPEN

# If VITE_CONVEX_URL or VITE_CLERK_PUBLISHABLE_KEY are missing,
# `vite.config.ts` aborts right here with a clear message. They used to
# produce an image that started fine and answered 500 on every route, which
# is much worse to diagnose.
RUN npm run build

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
