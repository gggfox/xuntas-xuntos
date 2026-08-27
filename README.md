# xuntas-xuntos

Registro a la Convocatoria General 2026–2027 del Programa de Desarrollo de
XUNTAS+XUNTOS.

**Ventana:** 4 al 18 de septiembre de 2026 · **Destino:** `app.xuntas.org`

Stack: TanStack Start · Convex · Clerk · Resend · Paraglide · Tailwind v4

- Decisiones y su porqué → [`docs/DECISIONES.md`](docs/DECISIONES.md)
- Reglas de marca → [`docs/MARCA.md`](docs/MARCA.md)
- DNS de `xuntas.org` → [`DNS-NOTES.md`](DNS-NOTES.md)

---

## Puesta en marcha

Los pasos 1 y 2 son interactivos y hay que correrlos una vez. Sin ellos no
existe `convex/_generated/` y el proyecto no compila.

### 1. Convex

```bash
npx convex dev
```

Crea el proyecto **bajo una cuenta de XUNTAS**, no personal. Genera
`convex/_generated/` y escribe `CONVEX_DEPLOYMENT` en `.env.local`. Copia la URL
que imprime a `VITE_CONVEX_URL` en `.env.local`.

Déjalo corriendo en una terminal mientras desarrollas: sincroniza funciones y
esquema en caliente.

### 2. Clerk

En el dashboard de Clerk:

1. **API keys → copia el _Frontend API URL_.** Ese es el valor de
   `CLERK_JWT_ISSUER_DOMAIN`. Ya no existe una plantilla JWT de Convex ni una
   integración que activar: es simplemente esa URL.
   Dev: `https://<slug>.clerk.accounts.dev` · Prod: `https://clerk.xuntas.org`.
   Truco: el host va codificado en base64 dentro de la propia publishable key,
   después del prefijo `pk_test_` / `pk_live_`.
2. **User & authentication → Email**: deja *Email verification code* y apaga
   *Email verification link*. En la pestaña **Password**, apaga contraseñas.
   En **SSO connections**, habilita Google.
3. **Webhooks → nuevo endpoint** apuntando a
   `https://<tu-deployment>.convex.site/clerk-webhook`, con los eventos
   `user.created`, `user.updated` y `user.deleted`. Copia el *Signing Secret*.

### 3. Variables de entorno

Locales, en `.env.local` (ver [`.env.example`](.env.example)):

```
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
VITE_CONVEX_URL=
```

En Convex, que es donde corre el backend:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://clerk.xuntas.org
npx convex env set CLERK_WEBHOOK_SECRET whsec_...
npx convex env set RESEND_API_KEY re_...
npx convex env set APP_URL https://app.xuntas.org
npx convex env set RESEND_TEST_MODE false   # ojo: sin esto solo envía a @resend.dev
```

### 4. Resend

El dominio ya está verificado (ver `DNS-NOTES.md`). Falta el webhook de estados
de entrega: apunta uno a `https://<tu-deployment>.convex.site/resend-webhook`
con todos los eventos `email.*`, y guarda el secreto:

```bash
npx convex env set RESEND_WEBHOOK_SECRET whsec_...
```

### 5. Correr

```bash
npm install && npm run dev
```

---

## Administradores

No hay pantalla de gestión de roles todavía. Un admin se crea invitando desde
Clerk con `publicMetadata` puesto a:

```json
{ "role": "admin" }
```

El webhook `user.updated` espeja el rol a Convex.

---

## Despliegue

Docker sobre Hostinger + Dokploy. El proyecto en Dokploy es `xuntas-xuntos`,
con dos environments — `staging` y `production` — y un servicio `frontend` en
cada uno. `app.xuntas.org` apunta al VPS por registro A (ver `DNS-NOTES.md`).

**Todo lo que empieza por `VITE_` es build arg, no variable de runtime.** Vite
las incrusta en el bundle del cliente durante el build, así que cambiar el
valor en Dokploy no hace nada hasta que vuelvas a construir. Es también la
razón de que staging y producción tengan que construirse por separado aunque
salgan del mismo commit.

| Variable | Dónde va | Por qué |
|---|---|---|
| `VITE_CONVEX_URL` | build arg | queda en el bundle |
| `VITE_CLERK_PUBLISHABLE_KEY` | build arg | queda en el bundle |
| `VITE_CLERK_SIGN_IN_URL` | build arg | idem |
| `VITE_CLERK_SIGN_UP_URL` | build arg | idem |
| `VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | build arg | idem |
| `VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | build arg | idem |
| `VITE_VENTANA_SIEMPRE_ABIERTA` | build arg | **solo staging**, jamás producción |
| `CLERK_SECRET_KEY` | runtime | un `ARG` queda en `docker history` |
| `CLERK_PUBLISHABLE_KEY` | runtime | el SSR de Clerk la lee de `process.env`, **sin** prefijo `VITE_`. Mismo valor que la de arriba |
| `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`, `RESEND_API_KEY`, `APP_URL` | Convex | `npx convex env set` — no pasan por Docker |

En Dokploy los build args viven en la pestaña **Environment → Build Time
Arguments** de cada servicio, y apuntan a las variables del environment con
`${{environment.NOMBRE}}`, para no repetir secretos en cada servicio.

Para reproducirlo a mano:

```bash
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

Tres ramas, en cadena:

```
main  --(checks + Convex staging)-->  staging  --(release manual)-->  production
```

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ci-main.yml` | push a `main` | typecheck + build; si pasan, despliega Convex staging y adelanta la rama `staging` |
| `release.yml` | **a mano** (Actions → Run workflow) | despliega Convex producción y adelanta `production` a `staging` |
| `convex-production.yml` | push a `production` | red de seguridad: despliega Convex si alguien empuja a `production` desde su máquina |

El contenedor no lo construye ningún workflow: cada push a `staging` o
`production` llega a Dokploy por el webhook de su GitHub App, y Dokploy
construye la imagen en el VPS.

En los dos saltos Convex va **antes** que la rama, para que el esquema nuevo
esté arriba antes de que el frontend nuevo lo consulte.

`release.yml` es manual a propósito: con `autoDeploy` encendido, todo lo que
entra a `production` sale a usuarios reales. Durante la convocatoria esa
decisión la toma una persona.

> **Por qué el despliegue de Convex vive dentro de cada workflow y no se
> encadena.** Los push hechos con `GITHUB_TOKEN` no disparan workflows de
> Actions — GitHub lo impide para evitar bucles infinitos. El webhook de la
> GitHub App de Dokploy sí llega, así que el contenedor sí se construye solo.

Secretos necesarios (Settings → Secrets and variables → Actions):

| Secreto | Para |
|---|---|
| `CONVEX_PROD_DEPLOY_KEY` | `release.yml` y `convex-production.yml` |
| `CONVEX_STAGING_DEPLOY_KEY` | `ci-main.yml` — **todavía no existe**; mientras falte, el paso de Convex staging se salta con un aviso y la cadena sigue |

Un merge a `production` dispara **dos** despliegues independientes:

| Qué | Quién lo dispara | Qué hace |
|---|---|---|
| Contenedor (frontend) | webhook de la GitHub App de Dokploy | clona `production` en el VPS, construye el Dockerfile con los build args del environment y cambia el contenedor |
| Backend de Convex | `.github/workflows/convex-production.yml` | `npx convex deploy` — funciones, esquema y crons |

Convex va en GitHub Actions y no dentro del Dockerfile a propósito: es un
backend aparte, y meterlo en el build lo ejecutaría en cada rebuild aunque no
haya cambiado una función.

Los dos arrancan con el mismo push. Convex suele terminar primero — segundos
contra los minutos del build de Docker — que es el orden deseable: el esquema
nuevo arriba antes de que el frontend nuevo lo consulte. **No hay nada que lo
garantice** más que esa diferencia de duración.

Requiere el secreto `CONVEX_PROD_DEPLOY_KEY` en el repo (Settings → Secrets
y variables → Actions), generado desde el dashboard de Convex con permiso
`deployment:deploy`, o con:

```bash
npx convex deployment token create ci-token --deployment prod
```

Las variables que vive en Convex (`CLERK_JWT_ISSUER_DOMAIN`,
`CLERK_WEBHOOK_SECRET`, `RESEND_API_KEY`, `APP_URL`) **no** las despliega este
workflow: se configuran una vez con `npx convex env set` y persisten en el
deployment.

### Cómo arranca el contenedor

`vite build` **no** genera un servidor que escuche un puerto. Deja dos mitades
en `dist/`:

- `dist/server/server.js` — un handler `fetch` al estilo web, sin socket.
- `dist/client/` — los assets estáticos.

`server.mjs` es quien las une y abre el puerto, usando `srvx` (la misma
librería que `vite preview` usa por dentro): sirve `dist/client` como
middleware y cae al SSR para todo lo demás.

El bundle de SSR **no** es autocontenido — importa `react`, `@tanstack`,
`@clerk`, `convex` y alguna más por nombre. Por eso la imagen lleva
`node_modules` podado con `npm prune --omit=dev`, y `package.json` (sin
`"type": "module"` Node leería `dist/server/server.js` como CommonJS).

---

## Estructura

```
convex/                 backend
  schema.ts             tablas e índices — los tres ejes de estado
  users.ts              espejo de Clerk, filtro de edad, roles
  tutor.ts              autorización del tutor por token
  registros.ts          borrador, envío, validación
  emails.ts             plantillas y envío durable
  http.ts               webhooks de Clerk y Resend
  lib/ciclo.ts          fechas de la convocatoria — fuente única

src/
  routes/               / · /empezar · /crear-cuenta · /entrar
                        /mi-registro · /autorizar/$token
  components/           AppBar, FormularioRegistro, pantallas de Clerk
  lib/                  formulario, preAlta, apariencia de Clerk
  styles.css            @theme — fuente única del sistema visual

messages/es.json        todo el texto en español
messages/en.json        vacío a propósito
```
