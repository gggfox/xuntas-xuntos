# Decisiones — Registro XUNTAS+XUNTOS, ciclo 2026–2027

Registro de las decisiones de arquitectura y producto, con el porqué. El código
apunta aquí cuando algo se ve raro a primera vista pero es deliberado.

Última revisión: 26 de agosto de 2026.

---

## Producto

**La ventana es del 4 al 18 de septiembre de 2026.** El 4, no el 1: los
prototipos decían ambas cosas y XUNTAS confirmó el 4. Las constantes viven en
`convex/lib/ciclo.ts` y en ningún otro lado.

**El alcance del lanzamiento es registro y captura de datos.** La tabla de
administración llega después: nadie lee un registro antes del 23 de septiembre,
así que no bloquea la salida.

**El formulario es el de `registro_xuntas.html`, campo por campo.** Esa forma ya
la aprobó XUNTAS. Cambiar campos o textos reabre una conversación que no cabe en
el calendario.

**El portal de seis roles (`portal_xuntas.html`) es referencia visual, no
especificación.** Los roles `coach` y `direccion` no se construyen este ciclo.

---

## Cuenta primero, formulario después

Se crea la cuenta en Clerk antes de llenar el formulario. Es una decisión de
XUNTAS, tomada sobre la recomendación contraria: un muro de registro delante de
un embudo de conversión con ventana de catorce días cuesta solicitudes.

Se construyó como se pidió. La mitigación es el filtro de edad y el autoguardado
del borrador.

---

## Tres ejes de estado, no un enum

`users.emailVerificado`, `tutorAuth.confirmadoEn` y `registros.estado` son campos
independientes a propósito.

Colapsarlos en un solo `status` obliga a inventar estados combinados
(`enviado_sin_tutor`, `validado_sin_tutor`…) que se multiplican y terminan en una
migración. Separados, cada eje avanza solo.

---

## El filtro de edad va antes de Clerk, y lo resuelve el servidor

La convocatoria dice que el tutor autoriza **la creación de la cuenta**. Si la
fecha de nacimiento se preguntara en el formulario, la cuenta de una persona
menor de edad ya existiría antes de saber que hacía falta autorización — y no se
puede des-crear.

Por eso `/empezar` pregunta la fecha primero. Y la respuesta la resuelve el
**servidor**: la pantalla manda la fecha a `preAltas.crear`, Convex calcula
`esMenor`, guarda la fila y devuelve un token. Ese token —una referencia opaca,
sin ningún dato personal— es lo único que viaja por `unsafeMetadata` de Clerk y
lo único que guarda `sessionStorage`. El webhook `user.created` lo canjea.

El primer diseño mandaba la fecha de nacimiento y el correo del tutor por
`unsafeMetadata`, que el cliente puede reescribir cuando quiera: bastaba con
editarla para declararse mayor de edad y saltarse la autorización, sin dejar
rastro. Hoy lo peor que se puede hacer es apuntar a otra pre-alta propia, que
también calculó el servidor.

**Sin fecha no se envía registro.** Si el alta se completa sin una pre-alta
válida —pasa si se pierde el token en el rodeo por Google—, la cuenta queda con
la edad *desconocida*, no *mayor de edad*. `/mi-registro` pide la fecha antes de
mostrar el formulario y `registros.enviar` la exige como respaldo. Confundir
"no sé" con "es mayor" era exactamente el hueco.

**Las pre-altas sin usar se borran.** Guardan la fecha de nacimiento de una
persona posiblemente menor y el correo de su tutor sin que nadie haya consentido
nada todavía. Vencen a las dos horas y un cron las borra.

**La cuenta sí se crea sin autorización.** Queda "en progreso": el registro se
puede enviar, pero se marca ruidosamente y lo resuelve una persona.

**Nunca se auto-rechaza a un menor por falta de autorización.** Que una madre o
un padre no abra un correo no puede costarle la solicitud a su hija.

**La casilla del formulario no es el consentimiento.** Una casilla que palomea
una persona de quince años declarando que su tutor está de acuerdo no es
consentimiento. El consentimiento es el clic del tutor en su propio correo. Por
eso `ck4` del prototipo no se conserva como autorización.

---

## Webhook de Clerk, no upsert perezoso

El usuario llega a Convex por el webhook `user.created`, no la primera vez que
hace una consulta autenticada.

Un upsert perezoso no deja rastro de quien se da de alta el 5 de septiembre y no
vuelve — y esa es justo la lista a la que XUNTAS va a querer escribirle antes del
cierre.

---

## Editable hasta el cierre, luego congelado

Se puede editar hasta el 18 de septiembre 23:59, hora del centro de México. La
ventana se valida en el servidor (`exigirVentanaAbierta`), no solo en la UI.

El Consejo empieza a revisar el 23. Si los registros siguieran cambiando después,
estarían calificando un blanco móvil.

México no aplica horario de verano desde 2022, así que `America/Mexico_City` es
UTC-6 todo el año y las constantes se guardan en UTC.

---

## Correo con ejecución durable

Se usa el componente `@convex-dev/resend` y no la API de Resend directa, porque
da cola, reintentos e idempotencia.

Importa para el correo del tutor: si Resend está caído cinco minutos, el correo
sale cuando vuelva en lugar de perderse. Y si el envío se reintenta, la clave de
idempotencia evita mandarle el mismo mensaje tres veces a un padre de familia.

`RESEND_TEST_MODE` debe pasar a `false` para enviar a direcciones reales.

---

## Datos

**Arreglos anidados** (`resultados`, `rankings`, `calendario`): son pequeños,
siempre se leen junto al registro y Convex los maneja de forma nativa.
Normalizarlos solo pagaría si hubiera que consultar entre atletas.

**`ciclo` en todo.** `registros.ciclo` y `tutorAuth.ciclo`. La convocatoria se
vuelve a correr en 2027; un campo hoy evita una migración entonces.

**`tutorAuth` cuelga del usuario, con `ciclo`.** El tutor autoriza la cuenta, no
el formulario — pero queda rastro por convocatoria. Es tabla aparte y no campo
anidado para poder indexar el token y resolver el enlace del correo en O(1).

**`esMenorAlRegistrarse` se congela.** No se recalcula: si se recalculara, quien
cumple 18 a mitad del proceso dejaría de "necesitar" la autorización que ya se
pidió, y se perdería el rastro del consentimiento.

**La baja borra de verdad.** `users.baja` elimina el registro y el rastro del
tutor, no marca una bandera. Si alguien ejerce su derecho de cancelación bajo la
LFPDPPP, sus datos se van.

---

## i18n desde el primer día

Paraglide con prefijo de ruta (`/es/...`, `/en/...`). Español poblado, inglés
vacío a propósito.

El prefijo se pone ahora porque retrofitearlo después obliga a cambiar todas las
rutas y rompe cualquier enlace ya compartido. Quien quita y pone el prefijo es la
opción `rewrite` del router (`src/router.tsx`); `paraglideMiddleware` solo
resuelve el idioma y lo deja en AsyncLocalStorage. Si ambos reescribieran, se
ciclan los redirects.

Nota: la traducción sirve para el chrome. La carta de motivos, los nombres de
torneos y los clubes son contenido de la persona y ninguna librería los traduce.

---

## Pendientes que no son del proveedor

1. **Aviso de privacidad y bases.** XUNTAS los está buscando. Sigue siendo
   **bloqueante**: las rutas y los enlaces desde las casillas ya existen, pero
   con el andamio y no con el texto. Mientras `listo` sea `false` en
   `src/lib/documentos.ts`, las páginas salen marcadas como borrador.
2. **Política si el tutor nunca confirma.** La recomendación es retener para
   seguimiento manual, nunca auto-rechazar. Falta la decisión formal.
3. **Correos que reciben invitación de admin.** Se dan de alta desde Clerk.
4. **XUNTOS en la tienda Shopify.** `xuntas.org` solo habla del programa
   femenil. Fuera del alcance de este trabajo, pero si no se actualiza, un
   registrante varón nunca llega al formulario.

---

## Deuda conocida

- **El VPS es del proveedor, no de XUNTAS.** Se acordó migrar después. Anotado
  hoy para no descubrirlo en la entrega.
- **Convex es SaaS.** Los datos no viven en el VPS de Hostinger sino en
  convex.cloud. Relevante si alguien pregunta por residencia de datos de menores
  mexicanos.
- **La localización `esMX` de Clerk es de la comunidad**, no oficial. Hay que
  leer las pantallas de alta antes del lanzamiento.

Resueltas desde entonces:

- ~~La ruta del entrypoint en el `Dockerfile` está sin verificar.~~ Verificada y
  arreglada: `vite build` no generaba `.output` en absoluto. `server.mjs` une
  las dos mitades de `dist/` y abre el socket. Ver el README.
- ~~El filtro de edad viaja en `unsafeMetadata`.~~ Ahora lo resuelve el servidor
  en `convex/preAltas.ts` y por Clerk solo viaja un token opaco.
