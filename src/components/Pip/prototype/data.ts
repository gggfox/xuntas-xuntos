/*
 * PROTOTYPE — throwaway. Fake posts for the PIP feed variants. The shapes
 * follow the spec loosely; nothing here is the schema.
 */
export type Attachment =
  | { type: 'image'; label: string; ratio: string; hue: number }
  | { type: 'video'; label: string; duration: string }
  | { type: 'youtube'; title: string; duration: string; unavailable?: boolean }

export type Comment = {
  id: string
  author: string
  lead?: boolean
  /** A member since removed from the programme. */
  inactive?: boolean
  body: string
  at: string
  visibility: 'lead' | 'group'
  hidden?: boolean
  replies: Comment[]
}

export type Reaction = { emoji: string; count: number; mine: boolean }

export type Post = {
  id: string
  kind: 'content' | 'session' | 'challenge'
  title: string
  body: string
  author: string
  publishedAt: string
  editedAt?: string
  attachments: Attachment[]
  commentsVisibility: 'off' | 'lead' | 'group'
  reactions: Reaction[]
  comments: Comment[]
}

export const ME = 'Regina Ontiveros'
export const LEAD = 'Mtra. Renata Fuentes'

export const KIND_LABEL: Record<Post['kind'], string> = {
  content: 'Contenido',
  session: 'Sesión en vivo',
  challenge: 'Reto',
}

export const QUICK_EMOJI = ['👍', '❤️', '💡', '🔥', '🙌']
export const MORE_EMOJI = ['😂', '😮', '😢', '👏', '🎯', '⛳', '💪', '🧠', '🌱', '✨', '🤝', '👀', '🫶', '😤', '🥲', '🙏', '🏌️', '🏆', '🌤️', '😴', '🫡', '🤯', '😌', '🥹', '💯', '🎉', '🍀', '📝', '⏱️', '🧘', '🤞', '😅']

export const SEED: Post[] = [
  {
    id: 'p5',
    kind: 'challenge',
    title: 'Reto de 7 días: tres respiraciones antes de cada tiro largo',
    body: `Un solo cambio, concreto y pequeño, que se conecte con los videos de este mes.

- **Qué:** tres respiraciones completas antes de cada tiro con madera o híbrido.
- **Cuándo:** del lunes 14 al domingo 20 de septiembre, en práctica y en torneo.
- **Cómo lo cuentas:** un comentario aquí al terminar la semana. Qué cambió, qué no.

No hay respuesta correcta. Lo que quiero leer es lo que notaste.`,
    author: LEAD,
    publishedAt: '2026-09-12T09:00:00-06:00',
    attachments: [],
    commentsVisibility: 'group',
    reactions: [
      { emoji: '🔥', count: 7, mine: true },
      { emoji: '💪', count: 4, mine: false },
      { emoji: '👍', count: 2, mine: false },
    ],
    comments: [
      {
        id: 'c1',
        author: 'Marcelo Treviño',
        body: 'Acepto. El driver es donde más me acelero, ahí lo voy a probar primero.',
        at: '2026-09-12T18:20:00-06:00',
        visibility: 'group',
        replies: [
          {
            id: 'c1r1',
            author: LEAD,
            lead: true,
            body: 'Perfecto. Fíjate también en el *segundo* tiro después de un mal drive: ahí se decide el hoyo.',
            at: '2026-09-12T20:05:00-06:00',
            visibility: 'group',
            replies: [],
          },
        ],
      },
      {
        id: 'c2',
        author: 'Sofía Lozano',
        inactive: true,
        body: 'Yo lo hice en el Regional y me ayudó en los par 5.',
        at: '2026-09-13T10:41:00-06:00',
        visibility: 'group',
        replies: [],
      },
    ],
  },
  {
    id: 'p4',
    kind: 'session',
    title: 'Office hours de septiembre',
    body: `Sesión en vivo para platicar los dos videos del mes y cómo llevarlos a tu día a día y al golf. Cada grupo tiene su propio horario.

**Jueves 17 de septiembre**

- XUNTAS · menores de 19: 17:00 h (CDMX)
- XUNTOS · menores de 19: 18:15 h (CDMX)
- XUNTAS · 19 años o más: 19:30 h (CDMX)
- XUNTOS · 19 años o más: 20:45 h (CDMX)

Entra por aquí: https://zoom.us/j/000000001

Trae una situación concreta de las últimas dos semanas donde te hayas frustrado. La vamos a desarmar entre todas.`,
    author: LEAD,
    publishedAt: '2026-09-10T08:00:00-06:00',
    attachments: [],
    commentsVisibility: 'lead',
    reactions: [{ emoji: '🙌', count: 5, mine: false }],
    comments: [],
  },
  {
    id: 'p3',
    kind: 'content',
    title: 'Manejo de la frustración: los dos videos del mes',
    body: `## Este mes trabajamos qué hacemos con el error

Cómo lo interpretamos, cuánto tiempo lo cargamos y cómo volvemos al presente.

Después de cada video, escribe qué aprendiste o qué te hizo pensar. **Tu comentario lo leo solo yo.**

> Dos atletas con el mismo doble bogey terminan la ronda de forma distinta. La diferencia no está en el golpe: está en la historia que se cuentan después.

La hoja de trabajo va al final. Imprímela o llénala en el teléfono, como prefieras.`,
    author: LEAD,
    publishedAt: '2026-09-01T07:30:00-06:00',
    attachments: [
      { type: 'youtube', title: 'El error no es el problema, la interpretación sí', duration: '18 min' },
      { type: 'youtube', title: 'Volver al presente en 30 segundos', duration: '12 min', unavailable: true },
      { type: 'image', label: 'Hoja de trabajo · septiembre', ratio: '4 / 3', hue: 64 },
    ],
    commentsVisibility: 'lead',
    reactions: [
      { emoji: '💡', count: 9, mine: false },
      { emoji: '❤️', count: 6, mine: true },
    ],
    comments: [
      {
        id: 'c3',
        author: ME,
        body: 'Lo que más me pegó fue que el doble bogey dura lo que yo decida. En el Regional cargué el hoyo 7 hasta el 12. Cinco hoyos perdidos por algo que ya había pasado.',
        at: '2026-09-03T21:12:00-06:00',
        visibility: 'lead',
        replies: [
          {
            id: 'c3r1',
            author: LEAD,
            lead: true,
            body: 'Eso que describes tiene nombre: rumiación. Lo vemos en las office hours. Mientras tanto, ¿en qué hoyo te diste cuenta de que seguías ahí?',
            at: '2026-09-04T09:30:00-06:00',
            visibility: 'lead',
            replies: [],
          },
        ],
      },
    ],
  },
  {
    id: 'p2',
    kind: 'challenge',
    title: 'Reto de agosto: anotar un aprendizaje al terminar cada práctica',
    body: `Una línea. No un párrafo. Una línea al cerrar la bolsa, siete días seguidos.

Al terminar la semana, cuéntame aquí cuál fue la que más te sorprendió.`,
    author: LEAD,
    publishedAt: '2026-08-24T09:00:00-06:00',
    attachments: [],
    commentsVisibility: 'group',
    reactions: [{ emoji: '🌱', count: 11, mine: true }],
    comments: [
      {
        id: 'c4',
        author: 'Valentina Ruiz',
        body: '"Cuando practico con música no escucho el contacto." Eso fue el martes.',
        at: '2026-08-31T19:00:00-06:00',
        visibility: 'group',
        replies: [],
      },
      {
        id: 'c5',
        author: 'Diego Sada',
        body: 'Comentario retirado por la encargada.',
        at: '2026-08-31T22:10:00-06:00',
        visibility: 'group',
        hidden: true,
        replies: [],
      },
    ],
  },
  {
    id: 'p1',
    kind: 'content',
    title: 'Bienvenida al Programa Integral de Performance',
    body: `## Qué es esto

Cada mes vas a encontrar aquí dos videos, una sesión en vivo por grupo y un reto de siete días. Nada de esto se califica.

### Lo que sí te pido

1. Ver los videos antes de la sesión.
2. Escribir después de cada uno, aunque sea una línea.
3. Llegar a la sesión con una situación real.

Lo que escribas debajo de un video lo leo **solo yo**. Ni tu coach, ni la asociación. Cuando un reto sea para compartir entre todas, lo vas a ver marcado.`,
    author: LEAD,
    publishedAt: '2026-08-03T10:00:00-06:00',
    editedAt: '2026-08-05T16:40:00-06:00',
    attachments: [
      { type: 'video', label: 'Renata se presenta', duration: '4 min' },
      { type: 'image', label: 'Calendario del programa 2026–2027', ratio: '16 / 9', hue: 200 },
    ],
    commentsVisibility: 'off',
    reactions: [
      { emoji: '❤️', count: 14, mine: false },
      { emoji: '🙏', count: 3, mine: false },
    ],
    comments: [],
  },
]

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function monthTitle(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

export function timeLabel(iso: string): string {
  const d = new Date(iso)
  return `${dayLabel(iso)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const ZOOM_RE = /https?:\/\/[\w.-]*zoom\.us\/[^\s)]+/i
