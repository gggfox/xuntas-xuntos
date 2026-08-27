# Despliegue — Convocatoria 2026–2027

La ventana abre el **4 de septiembre de 2026** y cierra el **18**. No hay
segunda oportunidad: si algo se rompe el día 4, se rompe con familias
intentando registrarse.

Son dos despliegues separados y hay que hacer **los dos**:

| Qué | Dónde vive | Cómo se sube |
| --- | --- | --- |
| Backend (`convex/`) | Convex Cloud | `npx convex deploy` |
| Frontend + SSR (`src/`) | Contenedor en Hostinger + Dokploy | `docker build` + deploy |

Subir la imagen sin haber corrido `convex deploy` deja la app hablándole a un
backend viejo, con el esquema anterior. Siempre en ese orden: **backend primero**.

---

## 0. Dev y prod son dos bases de datos

Convex separa `dev` y `prod` por completo: distintas funciones, distintos datos
y **distintas variables de entorno**. Casi todo error de configuración sale de
aquí.

```bash
npx convex env list             # dev
npx convex env list --prod      # prod   ← el que importa el 4 de septiembre
```

Todo comando de `convex env` que aparezca abajo lleva `--prod` a propósito.

---

## 1. Backend

### 1.1 Variables en el deployment de producción

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://clerk.xuntas.org
npx convex env set --prod CLERK_WEBHOOK_SECRET    whsec_...
npx convex env set --prod RESEND_API_KEY          re_...
npx convex env set --prod RESEND_WEBHOOK_SECRET   whsec_...
npx convex env set --prod APP_URL                 https://app.xuntas.org
npx convex env set --prod RESEND_TEST_MODE        false
```

Sobre dos de ellas, que son las que fallan en silencio:

- **`RESEND_TEST_MODE=false`.** Sin esto Resend acepta únicamente direcciones
  `@resend.dev`. El correo de autorización al tutor **no le llega a nadie** y no
  hay error visible en la app: el registro se ve bien y el tutor nunca se entera.
- **`APP_URL`.** Es la base de los enlaces de los correos. Si queda apuntando a
  `localhost`, el enlace que recibe el tutor no abre nada.

Y una que **NO debe existir en producción**:

```bash
npx convex env list --prod | grep VENTANA_SIEMPRE_ABIERTA   # no debe salir nada
```

`VENTANA_SIEMPRE_ABIERTA` es la escotilla de desarrollo. En producción dejaría
entrar registros fuera de la convocatoria.

### 1.2 Subir las funciones

```bash
npm run deploy:convex        # = npx convex deploy
```

En una máquina sin sesión iniciada (CI), en vez de eso se exporta
`CONVEX_DEPLOY_KEY` (Convex Dashboard → Settings → Deploy Keys) y se corre el
mismo comando.

> **Por qué no va dentro del `docker build`.** Convex documenta
> `convex deploy --cmd 'npm run build'`, que además inyecta `VITE_CONVEX_URL`
> sola. Es cómodo, pero mete la deploy key en el build de la imagen y acopla
> "reconstruir el frontend" con "redesplegar el backend". Con dos personas y una
> ventana de dos semanas preferimos el paso explícito.

### 1.3 Webhooks apuntando a producción

La URL de los webhooks es la del deployment de **producción**
(`https://<prod>.convex.site/...`), no la de dev. Son endpoints distintos.

- **Clerk** → Webhooks → endpoint a `https://<prod>.convex.site/clerk-webhook`
  con `user.created`, `user.updated`, `user.deleted`.
- **Resend** → webhook a `https://<prod>.convex.site/resend-webhook` con los
  eventos `email.*`.

Los *signing secrets* de esos endpoints son los que van en
`CLERK_WEBHOOK_SECRET` y `RESEND_WEBHOOK_SECRET` **de prod**. Los de dev son
otros.

---

## 2. Frontend

### 2.1 Build args (tiempo de build)

Vite incrusta las `VITE_*` en el bundle del cliente **durante el build**. No son
variables de runtime: cambiarlas en Dokploy sin reconstruir no hace nada.

```bash
docker build \
  --build-arg VITE_CONVEX_URL=https://<prod>.convex.cloud \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx \
  -t xuntas-registro .
```

Si falta alguna, `vite.config.ts` aborta el build con un mensaje claro. Antes
producía una imagen que arrancaba bien y contestaba 500 en todas las rutas.

### 2.2 Variables de runtime (Dokploy → Environment)

```
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
```

Las dos. El middleware de Clerk corre en el SSR dentro del contenedor y exige
ambas; la `VITE_` del bundle del cliente no le sirve. Sin ellas: 500 en todas
las rutas, con `no secret key provided` o `Publishable key is missing` en el log.

`PORT` ya viene en `3000` desde el `Dockerfile`.

### 2.3 Node 24, no 22

El `Dockerfile` usa `node:24-alpine` y `package.json` declara `"engines":
{"node": ">=24"}`. **No lo bajes.** La estrategia `url` de Paraglide resuelve el
idioma con `URLPattern`, que es global a partir de Node 24. En Node 22 el
servidor arranca y contesta 500 en todas las rutas con `URLPattern is not
defined` — y no se ve en desarrollo si tu Node local es más nuevo.

---

## 3. Verificación después de desplegar

Con la imagen ya corriendo, contra el dominio real:

```bash
curl -o /dev/null -w '%{http_code}\n' https://app.xuntas.org/es/
curl -o /dev/null -w '%{http_code}\n' https://app.xuntas.org/es/empezar
curl -o /dev/null -w '%{http_code}\n' https://app.xuntas.org/es/entrar
```

Las tres deben dar `200`. Un `500` en todas suele ser una de las variables de
runtime de Clerk.

El contenedor trae `HEALTHCHECK` sobre `/es/`, así que Dokploy lo reinicia solo
si el SSR se cae.

### Prueba de humo, de punta a punta

Hazla con una cuenta real antes del 4, en producción. Es la única forma de saber
que los webhooks y los correos están bien:

1. `/es/empezar` con una **fecha de nacimiento de menor de edad** y un correo de
   tutor al que tengas acceso.
2. Crea la cuenta. Verifica el código por correo.
3. Que llegue el correo al tutor. Ábrelo, autoriza, y confirma que en
   `/es/mi-registro` el chip cambia a "Tutor autorizó".
4. Llena y envía el registro. Que llegue el correo de confirmación.
5. En el dashboard de Convex (prod), que existan las filas en `users`,
   `tutorAuth` y `registros`.
6. Repite el paso 1 con **fecha de mayor de edad** y confirma que NO pide tutor.
7. Prueba también el alta con **Google**, no solo con código por correo: es un
   camino distinto y es donde se pierde el pre-alta si algo está mal.

Si el paso 3 falla y todo lo demás funciona, el sospechoso número uno es
`RESEND_TEST_MODE`.

---

## 4. Revisión del Consejo

Todavía **no hay pantalla de administración** — se agrega después de que la
infraestructura esté cerrada. Mientras tanto, la revisión del 23 de septiembre
se hace desde el dashboard de Convex (Functions → correr a mano):

- `registros:listarParaAdmin` con `{}` para ver todo el ciclo, o
  `{"estado": "enviado"}` para lo que falta revisar. Cada fila trae
  `tutorRequerido` y `tutorConfirmado`.
- `registros:revisar` con
  `{"registroId": "...", "estado": "validado" | "rechazado", "nota": "..."}`.

Las dos exigen que la cuenta tenga `role: "admin"`, que se pone en Clerk con
`publicMetadata` `{ "role": "admin" }` y llega a Convex por el webhook
`user.updated`.

---

## 5. Lista de verificación

Antes del 4 de septiembre:

- [ ] `npx convex env list --prod` tiene las 6 variables de §1.1
- [ ] `VENTANA_SIEMPRE_ABIERTA` **no** aparece en prod
- [ ] `RESEND_TEST_MODE=false` en prod
- [ ] `npm run deploy:convex` corrido contra prod
- [ ] Webhook de Clerk apuntando al `.convex.site` de **prod**, con los 3 eventos
- [ ] Webhook de Resend apuntando al `.convex.site` de **prod**
- [ ] Imagen construida con los dos `--build-arg`, con las llaves `pk_live_`
- [ ] `CLERK_SECRET_KEY` y `CLERK_PUBLISHABLE_KEY` en el runtime de Dokploy
- [ ] Las tres rutas de §3 contestan 200 en `app.xuntas.org`
- [ ] Prueba de humo completa, con menor y con mayor de edad
- [ ] Prueba de humo con Google además de con código por correo
- [ ] Aviso de privacidad y bases con el texto final, y `listo: true` en
      `src/lib/documentos.ts` (mientras esté en `false`, las dos páginas salen
      marcadas como borrador y el formulario lo dice junto a la casilla)
- [ ] `npm run check` en verde (typecheck + pruebas)
- [ ] Alguien de XUNTAS leyó las pantallas de alta de Clerk en español
