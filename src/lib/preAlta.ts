/**
 * Puente entre el filtro de edad y el alta en Clerk.
 *
 * Vive en sessionStorage y no en la URL: la fecha de nacimiento de una persona
 * menor de edad y el correo de su tutor no van en una query string, ni al
 * historial del navegador, ni a los logs de nadie.
 *
 * De aquí pasa a `unsafeMetadata` de Clerk al crear la cuenta, y el webhook
 * `user.created` lo levanta hacia Convex.
 */

const CLAVE = 'xx.preAlta'

export type PreAlta = {
  fechaNacimiento: string
  tutorNombre?: string
  tutorEmail?: string
}

export function guardarPreAlta(datos: PreAlta): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(CLAVE, JSON.stringify(datos))
}

export function leerPreAlta(): PreAlta | null {
  if (typeof window === 'undefined') return null
  const crudo = window.sessionStorage.getItem(CLAVE)
  if (!crudo) return null
  try {
    const datos = JSON.parse(crudo) as PreAlta
    return datos.fechaNacimiento ? datos : null
  } catch {
    return null
  }
}

export function limpiarPreAlta(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(CLAVE)
}

/**
 * Edad cumplida. Se calcula en UTC para que no cambie según dónde esté quien
 * llena el formulario.
 */
export function edadEn(fechaNacimientoISO: string, ahora: number = Date.now()): number {
  const nac = new Date(fechaNacimientoISO)
  const hoy = new Date(ahora)
  let edad = hoy.getUTCFullYear() - nac.getUTCFullYear()
  const mes = hoy.getUTCMonth() - nac.getUTCMonth()
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nac.getUTCDate())) edad--
  return edad
}

export function esMenorDeEdad(fechaNacimientoISO: string, ahora: number = Date.now()): boolean {
  return edadEn(fechaNacimientoISO, ahora) < 18
}
