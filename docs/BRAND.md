# XUNTAS+XUNTOS brand — usage rules

This document explains **how** the visual system is used. The **values** live
in `src/styles.css`, inside the `@theme` block, and that file is the single
source of truth. If there were one hex code here and another one there, the
CSS would win — which is why there are none here.

To see the current values: open `src/styles.css`.

---

## The principle

The system is **light paper and black ink, with a single yellow accent**. It
looks more like a well-made print piece than like an app. Typography and thin
lines do almost all the work; color barely gets involved.

If something looks busy, it is almost always too much yellow or too little
space.

---

## Color

**The black is not black.** It is `--color-ink`, a warm black. Pure black
never appears. There are three ink weights for hierarchy and a fourth,
translucent one (`--color-soft`) for everything secondary: descriptions, help
texts, eyebrows.

**The background is not white.** The page is bone (`--color-paper`); the
cards are white (`--color-card`). That half tone of difference is what makes
a card read as a card without needing a shadow. **Do not use shadows.**

**Yellow gets spent.** It is the brand color and loses force as soon as it
repeats. Rules:

- One single solid-yellow element per screen — usually the primary button.
- Yellow **always** carries an ink border. Yellow on paper without a border
  reads as a rendering error.
- Never put yellow text on a light background: it does not contrast. For text
  on light there is `--color-ochre`.
- For notices, use `--color-yel-s` (the desaturated yellow) as background
  with `--color-yel-line` as border. That is the `.nota` class.

**Lines are translucent ink**, never solid gray. Two weights: `--color-line`
to separate, `--color-line-2` to outline controls.

**Semantic colors are for state only.** Green, amber, and red say something
about the data; they never decorate. If a red does not mean "this is wrong",
it is being used wrong.

**There is no dark mode.** It is a decision, not a to-do. It is declared in
`color-scheme: light only` and in the document's `<meta>` so the browser does
not invent one on top of the forms.

---

## Typography

Three families, each with one job, and none does another one's job.

**Display (`--font-disp`, Bricolage Grotesque).** Titles only. Always 700 or
800, always with negative tracking (`-0.024em`). On large titles the line
height drops to ~1.05: they have to look compact, almost tight. Never use it
for running text, nor below 14 px.

**Body (`--font-body`, IBM Plex Sans).** Everything that gets read. Weight
300 is not decorative: descriptions and supporting texts are set in light,
and that contrast with the 500/600 of the labels is half of the system's
hierarchy. Base 15 px, line height 1.5.

**Mono (`--font-mono`, IBM Plex Mono).** Labels, eyebrows, chips, metadata,
dates. Always in small caps, always with wide tracking (`0.12`–`0.14em`),
always small (10–11.5 px). It is the product's "system" voice, and that is
why it works: it stands apart without shouting. **Never** use it for
sentences.

The heading pattern is almost always the same, and it is worth respecting:

```
EYEBROW IN MONO            ← .eyebrow — which section this belongs to
Title in display           ← .h-display — what this is
Description in light       ← what it means, 62ch max
```

**Line width.** Running text is capped at `52ch`–`62ch`. A paragraph that
crosses the whole screen does not get read.

---

## Shape and space

**Radii:** `--radius-xt` (10 px) for cards and containers, `--radius-ctl`
(8 px) for fields, 7 px for buttons, `999px` for chips. The difference
between 10 and 8 is deliberate: containers feel a little softer than what
they contain.

**The numbers are specific on purpose.** The system uses 13.5 px, 11.5 px,
19 px, 21 px. Do not round them to the Tailwind scale — they come from the
prototype XUNTAS already approved, and together they have a rhythm that gets
lost when you normalize them.

**The max width depends on the task.** 900 px for forms and reading, 1240 px
for tables and panels.

---

## Accessibility — non-negotiable

- **The focus ring is yellow and thick**: 3 px, with 2 px of offset. Do not
  remove it or thin it down. A good share of these people fill out the form
  with a keyboard, on a borrowed laptop, at the club.
- **`prefers-reduced-motion` is honored** globally. It is already in
  `styles.css`.
- **Color is never the only signal.** Status chips carry text in addition to
  color. A red chip without a word says nothing to someone who cannot
  distinguish red.
- **Every label is tied to its field** with `htmlFor`/`id`. Errors are
  announced with `aria-invalid` and `aria-describedby`, not just by painting
  the border.

---

## Voice

Mexican Spanish, in the informal "tú", without solemnity and without
marketing.

**Say what happens and when.** "Revisamos tu registro antes del 23 de
septiembre" ("we review your registration before September 23") is better
than "en revisión" ("under review"). A status without a date generates emails
to the association.

**Explain the why when you ask for something odd.** The form asks for the
birth date before anything else; the screen says why. A field that justifies
itself gets answered.

**Name things the way XUNTAS names them.** "Programa de Desarrollo",
"Consejo Técnico", "bitácora", "equipo de trabajo", "rama femenil /
varonil". Do not invent synonyms: the organization already has its
vocabulary.

**Phrases from the call for applications that are not to be touched.** They
are approved and carry legal or institutional meaning:

- "No se solicita una beca: se solicita pertenecer." ("you are not applying
  for a scholarship: you are applying to belong")
- "La beca no se solicita, se otorga." ("the scholarship is not applied for,
  it is granted")
- "El registro no garantiza la admisión." ("registration does not guarantee
  admission")

**All copy lives in `messages/es.json`**, not inside the components. If you
are going to change a word, it changes there. `messages/en.json` carries the
English of every key — it was empty until the day the US college coaches
needed it, and it is filled now. The two files must hold the same keys: a key
in one and not the other is what Paraglide reports as a missing message.

