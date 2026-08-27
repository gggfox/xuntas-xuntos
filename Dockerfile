# syntax=docker/dockerfile:1

# Node 24 como mínimo, NO 22.
#
# La estrategia `url` de Paraglide resuelve el idioma con `URLPattern`, que es
# global a partir de Node 24. En Node 22 no existe y el servidor arranca, pero
# contesta 500 en TODAS las rutas con `URLPattern is not defined`. No se ve en
# desarrollo si tu Node local es más nuevo — solo dentro del contenedor.

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Las dependencias se copian antes que el código para aprovechar la caché de
# capas: cambiar un .tsx no vuelve a instalar node_modules.
COPY package.json package-lock.json ./
# `npm ci` respeta el lockfile al pie de la letra. Nunca uses `npm install`
# aquí: las versiones de producción tienen que ser las mismas que probaste.
RUN npm ci

COPY . .

# Convex y Clerk necesitan estas dos en tiempo de BUILD porque Vite las
# incrusta en el bundle del cliente (VITE_*). Se pasan con --build-arg desde
# Dokploy. Si faltan, `vite.config.ts` aborta el build con un mensaje claro en
# vez de dejar una imagen que contesta 500 en todas las rutas.
ARG VITE_CONVEX_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Genera .output/server/index.mjs (servidor de Node) y .output/public
# (estáticos del cliente), vía el plugin de Nitro en vite.config.ts.
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# curl para el HEALTHCHECK. Es lo único que se agrega a la imagen base.
RUN apk add --no-cache curl

# Usuario sin privilegios. El contenedor no necesita root para servir SSR.
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/.output ./.output

USER app
EXPOSE 3000

# El middleware de Clerk corre en el SSR y exige LAS DOS claves en tiempo de
# EJECUCIÓN — no basta con la VITE_ del bundle del cliente. Si faltan, cada
# ruta contesta 500 con "no secret key provided" / "Publishable key is
# missing". Se configuran como variables de entorno en Dokploy:
#
#   CLERK_SECRET_KEY        sk_live_...
#   CLERK_PUBLISHABLE_KEY   pk_live_...   (la misma que VITE_CLERK_PUBLISHABLE_KEY)
#
# NO se declaran con ENV aquí: son secretos y no deben quedar en la imagen.

# Dokploy reinicia el contenedor si esto falla. `/es/` es la portada real, no
# un endpoint sintético: si el SSR se rompe, el healthcheck se entera.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/es/ >/dev/null || exit 1

CMD ["node", ".output/server/index.mjs"]
