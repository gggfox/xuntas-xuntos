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

1. **Activa la integración de Convex** y copia el *Frontend API URL*.
2. Habilita solo **Google** y **Email code (OTP)**. Desactiva contraseñas.
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

Docker sobre Hostinger + Dokploy. `VITE_CONVEX_URL` y
`VITE_CLERK_PUBLISHABLE_KEY` van como **build args**, no como variables de
runtime: Vite las incrusta en el bundle del cliente durante el build.

```bash
docker build \
  --build-arg VITE_CONVEX_URL=https://xxx.convex.cloud \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx \
  -t xuntas-registro .
```

Después del primer build exitoso, **verifica la ruta del entrypoint** en el
`Dockerfile` contra lo que realmente generó `.output/`.

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
