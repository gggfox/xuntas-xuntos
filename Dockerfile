# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Las dependencias se copian antes que el código para aprovechar la caché de
# capas: cambiar un .tsx no vuelve a instalar node_modules.
COPY package.json package-lock.json ./
# `npm ci` respeta el lockfile al pie de la letra. Nunca uses `npm install`
# aquí: las versiones de producción tienen que ser las mismas que probaste.
RUN npm ci

COPY . .

# Convex necesita la URL en tiempo de build porque Vite la incrusta en el
# bundle del cliente (VITE_*). Se pasa con --build-arg desde Dokploy.
ARG VITE_CONVEX_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Usuario sin privilegios. El contenedor no necesita root para servir SSR.
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/.output ./.output

USER app
EXPOSE 3000

# OJO: verifica la ruta del entrypoint tras el primer `npm run build` exitoso.
# TanStack Start ha movido la salida entre versiones; si no arranca, revisa
# qué generó `.output/` y ajusta esta línea.
CMD ["node", ".output/server/index.mjs"]
