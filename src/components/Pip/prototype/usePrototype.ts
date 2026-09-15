import { useSearch } from '@tanstack/react-router'

/*
 * PROTOTYPE — throwaway. Do not merge into main.
 *
 * The question: what should the member's PIP feed look like? The spec
 * (docs/superpowers/specs/2026-09-14-pip-posts-groups-design.md) settles the
 * data — posts with a kind, attachments, reactions, a thread whose comments
 * are private to the lead by default — but not the page. Three variants on
 * one throwaway route, `/prototype/pip`, switchable via `?variant=a|b|c`:
 *
 *   a  Boletín      one reading column; a post is a letter, the month a divider
 *   b  Programa     a month rail and kind filters; the newest post is the hero
 *   c  Conversación a timeline with the lead's face; media as a strip, reactions
 *                   always in view, the thread inline like messages
 *
 * Round two, after the first three were judged (B's grouping and collapse won
 * on a phone, C's cleanliness won on a laptop, A's media scale was liked):
 *
 *   d  Tarjeta      one card holds everything — body, media on a uniform 16:9
 *                   grid, reactions, thread — under C's timeline on a laptop
 *   e  Programa 2   B with the rail replaced by a month select and kind chips in
 *                   a slim toolbar; collapsed rows keep their reactions
 *
 * Fake data, state in memory. Nothing here ships: `PROTOTYPE_ON` is false in
 * a production build, and the whole `prototype/` folder goes with the
 * throwaway branch once a variant wins.
 */
export const VARIANTS = ['a', 'b', 'c', 'd', 'e'] as const
export type Variant = (typeof VARIANTS)[number]

export const VARIANT_NAME: Record<Variant, string> = {
  a: 'Boletín · una columna',
  b: 'Programa · riel de meses',
  c: 'Conversación · línea de tiempo',
  d: 'Tarjeta · todo en una (ronda 2)',
  e: 'Programa 2 · barra de meses (ronda 3)',
}

export const PROTOTYPE_ON = !import.meta.env.PROD

export function parseVariant(v: unknown): Variant | undefined {
  return typeof v === 'string' && (VARIANTS as readonly string[]).includes(v) ? (v as Variant) : undefined
}

export function usePrototype(): Variant {
  const s = useSearch({ from: '/prototype/pip' })
  return s.variant ?? 'e'
}
