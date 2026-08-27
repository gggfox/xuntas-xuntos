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
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<slug>.clerk.accounts.dev
npx convex env set CLERK_WEBHOOK_SECRET whsec_...
npx convex env set RESEND_API_KEY re_...
npx convex env set APP_URL http://localhost:3000
```

> **`npx convex env set` escribe en el deployment de DESARROLLO.** Producción es
> un deployment aparte, con sus propias variables y su propia base de datos.
> Para tocar producción hay que agregar `--prod` a cada comando. Ver
> [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).
>
> `RESEND_TEST_MODE` se queda sin definir en desarrollo: así Resend solo acepta
> direcciones `@resend.dev` y no le llega correo a nadie por accidente.

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

Son **dos despliegues distintos** y hay que hacer los dos: el backend va a
Convex y el frontend va a un contenedor en Hostinger + Dokploy. Subir la imagen
sin haber corrido `convex deploy` deja la app hablándole a un backend viejo.

El procedimiento completo, en orden y con la lista de verificación previa al
4 de septiembre, está en **[`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)**. El
resumen:

```bash
# 1. Backend
npx convex deploy            # o: npm run deploy:convex

# 2. Imagen — VITE_* son build args: Vite las incrusta en el bundle del cliente
docker build \
  --build-arg VITE_CONVEX_URL=https://xxx.convex.cloud \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx \
  -t xuntas-registro .
```

Y en el entorno de **runtime** del contenedor (Dokploy → Environment), que es
distinto de los build args:

```
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
```

Las dos hacen falta: el middleware de Clerk corre en el SSR y sin ellas cada
ruta contesta 500. No basta con la `VITE_` del bundle del cliente.

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
