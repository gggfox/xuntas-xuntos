/**
 * The 32 federal entities of Mexico, in Spanish alphabetical order.
 *
 * Values and labels are the same string. A state is a proper noun, so there
 * is nothing to translate and nothing to look up: what the reader picks is
 * what the row stores and what an admin reads back. It lives in `convex/lib/`
 * for the usual reason — the browser offering a state the server would reject
 * is the bug this prevents.
 */
export const MEXICAN_STATES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
] as const

export type MexicanState = (typeof MEXICAN_STATES)[number]

/** Membership, without exposing the array's `includes` narrowing to callers. */
export function isMexicanState(value: string): value is MexicanState {
  return (MEXICAN_STATES as readonly string[]).includes(value)
}
