/**
 * Puente entre el filtro de edad y el alta en Clerk.
 *
 * Antes aquí vivían la fecha de nacimiento y el correo del tutor. Ya no: el
 * filtro de edad lo resuelve el servidor (`convex/preAltas.ts`) y lo único que
 * guarda el navegador es el token que devuelve, que es una referencia opaca.
 *
 * Sigue en sessionStorage y no en la URL para que ni siquiera el token quede en
 * el historial del navegador ni en los logs de nadie.
 */

const CLAVE = 'xx.preAltaToken'

export function guardarTokenPreAlta(token: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(CLAVE, token)
}

export function leerTokenPreAlta(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(CLAVE) || null
}

export function limpiarPreAlta(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(CLAVE)
}

/**
 * Edad cumplida, en hora del centro de México.
 *
 * Es solo para la interfaz: decidir si mostrar los campos del tutor mientras se
 * escribe la fecha. Quien decide de verdad es el servidor, que recalcula esto
 * mismo en `preAltas.crear`. Se reexporta desde el backend para que no puedan
 * discrepar.
 */
export { edadEn, esMenorDeEdad, fechaNacimientoValida } from '../../convex/lib/ciclo'
