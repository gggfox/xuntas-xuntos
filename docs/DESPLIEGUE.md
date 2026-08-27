# Despliegue — Convocatoria 2026–2027

La ventana abre el **4 de septiembre de 2026** y cierra el **18**. No hay
segunda oportunidad: si algo se rompe el día 4, se rompe con familias
intentando registrarse.

Este documento es el procedimiento y la lista de verificación. La descripción de
la infraestructura (Dokploy, Traefik, qué variable va en build y cuál en
runtime) está en el [`README`](../README.md#despliegue).

---

## 0. Cómo sale a producción

**La rama de producción es `production`, no `main`.** Un push ahí dispara dos
despliegues independientes:

| Qué | Quién | Cuánto tarda |
| --- | --- | --- |
| Backend de Convex | `.github/workflows/convex-production.yml` → `npx convex deploy` | segundos |
| Contenedor (frontend) | webhook de la GitHub App de Dokploy | minutos |

Los dos arrancan con el mismo push y **nada garantiza el orden**; en la práctica
Convex termina primero, que es el orden deseable — el esquema nuevo arriba antes
de que el frontend nuevo lo consulte.

> **Este despliegue cambia el esquema** (tabla `preAltas`) y agrega un cron.
> Convex aplica los dos en `convex deploy`. Si por lo que sea el contenedor
> llegara antes, la app pediría una tabla que todavía no existe. Con la
> convocatoria encima, vale la pena mirar que el workflow de Convex haya
> terminado en verde antes de dar por bueno el despliegue.

Requiere el secreto `CONVEX_PROD_DEPLOY_KEY` en el repo. Ver el README.

---

## 1. Dev y prod son dos bases de datos

Convex separa `dev` y `prod` por completo: distintas funciones, distintos datos
y **distintas variables de entorno**. Casi todo error de configuración sale de
aquí.

```bash
npx convex env list             # dev
npx convex env list --prod      # prod   ← el que importa el 4 de septiembre
```

Todo comando de `convex env` que aparezca abajo lleva `--prod` a propósito.

### Variables en el deployment de producción

`convex deploy` sube funciones, esquema y crons. **No sube las variables de
entorno**: esas se ponen una vez y persisten.

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
entrar registros fuera de la convocatoria. Ojo: tiene un gemelo del lado del
cliente, `VITE_VENTANA_SIEMPRE_ABIERTA`, que es **build arg** y solo debe
existir en el environment de staging.

### Webhooks apuntando a producción

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

## 2. El contenedor

Los detalles están en el README; lo que hay que recordar al desplegar:

- **Las `VITE_*` son build args.** Cambiarlas en Dokploy sin reconstruir no hace
  nada. Si falta alguna de las dos críticas (`VITE_CONVEX_URL`,
  `VITE_CLERK_PUBLISHABLE_KEY`), `vite.config.ts` aborta el build con un mensaje
  claro — antes producían una imagen que arrancaba bien y contestaba 500 en
  todas las rutas.
- **`CLERK_SECRET_KEY` y `CLERK_PUBLISHABLE_KEY` son de runtime.** Las dos. El
  middleware de Clerk corre en el SSR; sin ellas, 500 en todas las rutas con
  `no secret key provided` o `Publishable key is missing` en el log.
- **El contenedor trae `HEALTHCHECK`** sobre `/es/`, así que Dokploy lo reinicia
  solo si el SSR se cae.

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

### Prueba de humo, de punta a punta

Hazla con una cuenta real antes del 4, en producción. Es la única forma de saber
que los webhooks y los correos están bien:

1. `/es/empezar` con una **fecha de nacimiento de menor de edad** y un correo de
   tutor al que tengas acceso.
2. Crea la cuenta. Verifica el código por correo.
3. Que llegue el correo al tutor. Ábrelo, autoriza, y confirma que en
   `/es/mi-registro` el chip cambia a "Tutor autorizó".
4. Llena y envía el registro. Que llegue el correo de confirmación —  **a la
   dirección de la cuenta**, no a la que escribiste en el formulario.
5. En el dashboard de Convex (prod), que existan las filas en `users`,
   `tutorAuth` y `registros`, y que `users.fechaNacimiento` esté puesta.
6. Repite el paso 1 con **fecha de mayor de edad** y confirma que NO pide tutor.
7. Prueba el alta con **Google**, no solo con código por correo. Es un camino
   distinto y es el único donde se puede perder el token de pre-alta. Si se
   pierde, lo correcto es que `/es/mi-registro` **pida la fecha de nacimiento**
   antes de mostrar el formulario — no que te deje pasar como mayor de edad.

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

**Convex**
- [ ] `npx convex env list --prod` tiene las 6 variables de §1
- [ ] `RESEND_TEST_MODE=false` en prod
- [ ] `VENTANA_SIEMPRE_ABIERTA` **no** aparece en prod
- [ ] Secreto `CONVEX_PROD_DEPLOY_KEY` cargado en el repo
- [ ] El workflow `convex-production` terminó en verde y la tabla `preAltas`
      aparece en el dashboard de prod
- [ ] Webhook de Clerk al `.convex.site` de **prod**, con los 3 eventos
- [ ] Webhook de Resend al `.convex.site` de **prod**

**Contenedor**
- [ ] Build args del environment de producción con las llaves `pk_live_`
- [ ] `VITE_VENTANA_SIEMPRE_ABIERTA` **vacía** en producción
- [ ] `CLERK_SECRET_KEY` y `CLERK_PUBLISHABLE_KEY` en el runtime de Dokploy
- [ ] Las tres rutas de §3 contestan 200 en `app.xuntas.org`

**Contenido y código**
- [ ] Aviso de privacidad y bases con el texto final, y `listo: true` en
      `src/lib/documentos.ts` (mientras esté en `false`, las dos páginas salen
      marcadas como borrador y el formulario lo dice junto a la casilla)
- [ ] `npm run check` en verde (typecheck + pruebas)
- [ ] Prueba de humo completa, con menor y con mayor de edad
- [ ] Prueba de humo con Google además de con código por correo
- [ ] Alguien de XUNTAS leyó las pantallas de alta de Clerk en español
