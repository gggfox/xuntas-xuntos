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

# Todo lo que empieza por VITE_ tiene que existir AQUÍ, en tiempo de build:
# Vite lo incrusta en el bundle del cliente. Pasarlo como variable de runtime
# no sirve de nada — el bundle ya se compiló con el valor viejo (o con
# undefined). Se pasan con --build-arg; en Dokploy son los "Build Time
# Arguments" de cada environment, y por eso staging y producción necesitan
# builds separados aunque el commit sea el mismo.
#
# CLERK_SECRET_KEY NO va aquí. Es de runtime, y un ARG queda escrito en el
# historial de la imagen: `docker history` lo enseñaría a cualquiera que
# pudiera bajar la imagen.
ARG VITE_CONVEX_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_SIGN_IN_URL
ARG VITE_CLERK_SIGN_UP_URL
ARG VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
ARG VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL

# Escotilla de desarrollo. Sin valor por defecto a propósito: si no se pasa,
# queda vacía y la ventana de registro respeta el calendario. Ver
# convex/lib/ciclo.ts — NUNCA la pongas en 'true' en producción.
ARG VITE_VENTANA_SIEMPRE_ABIERTA

ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_SIGN_IN_URL=$VITE_CLERK_SIGN_IN_URL
ENV VITE_CLERK_SIGN_UP_URL=$VITE_CLERK_SIGN_UP_URL
ENV VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=$VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
ENV VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=$VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
ENV VITE_VENTANA_SIEMPRE_ABIERTA=$VITE_VENTANA_SIEMPRE_ABIERTA

RUN npm run build

# El bundle de SSR deja fuera react, @tanstack, @clerk, convex y unas cuantas
# más: dist/server/server.js las importa por nombre en tiempo de ejecución.
# Podar aquí y copiar el árbol ya resuelto sale más barato que un segundo
# `npm ci` en la etapa de runtime, y no vuelve a tocar la red.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Usuario sin privilegios. El contenedor no necesita root para servir SSR.
RUN addgroup -S app && adduser -S app -G app

# `vite build` deja dos mitades en dist/: el handler de SSR en dist/server y
# los assets del cliente en dist/client. Las dos hacen falta — server.mjs
# sirve los estáticos y cae al SSR para todo lo demás.
COPY --from=build --chown=app:app /app/dist ./dist

# Sin chown a propósito: el árbol es enorme y el usuario `app` solo necesita
# leerlo. Un --chown aquí añade una capa entera duplicada.
COPY --from=build /app/node_modules ./node_modules

# package.json NO es opcional. dist/server/server.js termina en .js, y sin
# "type": "module" en el directorio Node lo interpretaría como CommonJS y
# reventaría en el primer `import`.
COPY --chown=app:app package.json ./package.json
COPY --chown=app:app server.mjs ./server.mjs

USER app
EXPOSE 3000

# `vite build` NO genera un servidor que escuche: dist/server/server.js
# exporta un handler `fetch`, nada más. server.mjs es quien abre el socket.
CMD ["node", "server.mjs"]
