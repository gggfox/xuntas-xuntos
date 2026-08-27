/**
 * Tokens de un solo uso: el enlace del tutor y la referencia de pre-alta.
 *
 * Vive aparte de `users.ts` para que `preAltas.ts` no tenga que importar ese
 * módulo — se importan entre sí a través del webhook y el ciclo dejaba a
 * TypeScript sin poder inferir los tipos generados de Convex.
 */

/** 32 caracteres hex = 128 bits. No se adivina. */
export function nuevoToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
