# Marca XUNTAS+XUNTOS — reglas de uso

Este documento explica **cómo** se usa el sistema visual. Los **valores** viven
en `src/styles.css`, dentro del bloque `@theme`, y ese archivo es la única
fuente de verdad. Si aquí hubiera un hexadecimal y allá otro, ganaría el CSS —
por eso aquí no hay ninguno.

Para ver los valores vigentes: abre `src/styles.css`.

---

## El principio

El sistema es **papel claro y tinta negra, con un solo acento amarillo**. Se
parece más a un impreso bien hecho que a una app. Casi todo el trabajo lo hacen
la tipografía y las líneas finas; el color casi no interviene.

Si algo se ve cargado, casi siempre sobra amarillo o falta espacio.

---

## Color

**El negro no es negro.** Es `--color-ink`, un negro cálido. El negro puro
nunca aparece. Hay tres pesos de tinta para jerarquía y un cuarto translúcido
(`--color-soft`) para todo lo secundario: descripciones, ayudas, antetítulos.

**El fondo no es blanco.** La página es hueso (`--color-paper`); las tarjetas
sí son blancas (`--color-card`). Ese medio tono de diferencia es lo que hace que
una tarjeta se lea como tarjeta sin necesidad de sombra. **No uses sombras.**

**El amarillo se gasta.** Es el color de la marca y pierde fuerza en cuanto se
repite. Reglas:

- Un solo elemento amarillo sólido por pantalla — normalmente el botón principal.
- El amarillo **siempre** lleva borde de tinta. Amarillo sobre papel sin borde
  se lee como un error de render.
- Nunca pongas texto amarillo sobre fondo claro: no contrasta. Para texto sobre
  claro existe `--color-ochre`.
- Para avisos, usa `--color-yel-s` (el amarillo desaturado) de fondo con
  `--color-yel-line` de borde. Es la clase `.nota`.

**Las líneas son tinta translúcida**, nunca gris sólido. Dos pesos: `--color-line`
para separar, `--color-line-2` para delimitar controles.

**Los colores semánticos son solo para estado.** Verde, ámbar y rojo dicen algo
sobre los datos, nunca decoran. Si un rojo no significa "esto está mal", está
mal usado.

**No hay modo oscuro.** Es una decisión, no un pendiente. Está declarado en
`color-scheme: light only` y en el `<meta>` del documento para que el navegador
no invente uno encima de los formularios.

---

## Tipografía

Tres familias, cada una con un trabajo, y ninguna hace el trabajo de otra.

**Display (`--font-disp`, Bricolage Grotesque).** Solo títulos. Siempre 700 u
800, siempre con tracking negativo (`-0.024em`). En títulos grandes el interlineado
baja a ~1.05: tienen que verse compactos, casi apretados. Nunca la uses para
texto corrido, ni en menos de 14 px.

**Cuerpo (`--font-body`, IBM Plex Sans).** Todo lo que se lee. El peso 300 no es
decorativo: las descripciones y los textos de apoyo van en light, y ese
contraste con el 500/600 de las etiquetas es la mitad de la jerarquía del
sistema. Base 15 px, interlineado 1.5.

**Mono (`--font-mono`, IBM Plex Mono).** Etiquetas, antetítulos, chips, metadatos,
fechas. Siempre en versalitas, siempre con tracking amplio (`0.12`–`0.14em`),
siempre pequeña (10–11.5 px). Es la voz "de sistema" del producto y por eso
funciona: se distingue sin gritar. **Nunca** la uses para frases.

El patrón de encabezado es casi siempre el mismo, y conviene respetarlo:

```
ANTETÍTULO EN MONO         ← .eyebrow — de qué sección es esto
Título en display          ← .h-display — qué es esto
Descripción en light       ← qué significa, máximo 62ch
```

**Ancho de línea.** El texto corrido se limita a `52ch`–`62ch`. Un párrafo que
cruza toda la pantalla no se lee.

---

## Forma y espacio

**Radios:** `--radius-xt` (10 px) para tarjetas y contenedores, `--radius-ctl`
(8 px) para campos, 7 px para botones, `999px` para chips. La diferencia entre
10 y 8 es deliberada: los contenedores se sienten un poco más blandos que lo que
contienen.

**Los números son específicos a propósito.** El sistema usa 13.5 px, 11.5 px,
19 px, 21 px. No los redondees a la escala de Tailwind — vienen del prototipo que
XUNTAS ya aprobó y en conjunto tienen un ritmo que se pierde al normalizarlos.

**El ancho máximo depende de la tarea.** 900 px para formularios y lectura,
1240 px para tablas y paneles.

---

## Accesibilidad — no negociable

- **El foco es amarillo y grueso**: 3 px, con 2 px de separación. No lo quites ni
  lo adelgaces. Buena parte de esta gente llena el formulario con teclado, en una
  laptop prestada, en el club.
- **`prefers-reduced-motion` se respeta** globalmente. Ya está en `styles.css`.
- **El color nunca es la única señal.** Los chips de estado llevan texto además
  de color. Un chip rojo sin palabra no comunica nada a quien no distingue rojo.
- **Toda etiqueta va asociada a su campo** con `htmlFor`/`id`. Los errores se
  anuncian con `aria-invalid` y `aria-describedby`, no solo pintando el borde.

---

## Voz

En español de México, tuteando, sin solemnidad y sin marketing.

**Di lo que pasa y cuándo.** "Revisamos tu registro antes del 23 de septiembre"
es mejor que "en revisión". Un estado sin fecha genera correos a la asociación.

**Explica el porqué cuando pides algo raro.** El formulario pregunta la fecha de
nacimiento antes que nada; la pantalla dice por qué. Un campo que se justifica
se contesta.

**Nombra las cosas como XUNTAS las nombra.** "Programa de Desarrollo",
"Consejo Técnico", "bitácora", "equipo de trabajo", "rama femenil / varonil".
No inventes sinónimos: la organización ya tiene su vocabulario.

**Frases de la convocatoria que no se tocan.** Están aprobadas y cargan
significado legal o institucional:

- "No se solicita una beca: se solicita pertenecer."
- "La beca no se solicita, se otorga."
- "El registro no garantiza la admisión."

**Todo el texto vive en `messages/es.json`**, no dentro de los componentes. Si
vas a cambiar una palabra, se cambia ahí. `messages/en.json` existe vacío a
propósito: la traducción al inglés llega cuando haya que hablarle a los coaches
universitarios de Estados Unidos, y ese día será un trabajo de traducción y no
de arqueología.
