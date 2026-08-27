/**
 * Ventana de la Convocatoria General 2026–2027.
 *
 * México ya no aplica horario de verano (desde 2022), así que
 * America/Mexico_City es UTC-6 todo el año. Las constantes se guardan en UTC
 * para no depender de la zona horaria del servidor ni del navegador.
 */

export const CICLO_ACTUAL = '2026-2027'

/** 4 de septiembre de 2026, 00:00 America/Mexico_City. */
export const APERTURA_MS = Date.parse('2026-09-04T06:00:00.000Z')

/** 18 de septiembre de 2026, 23:59:59 America/Mexico_City. */
export const CIERRE_MS = Date.parse('2026-09-19T05:59:59.999Z')

/** Fecha comprometida a los registrantes para la revisión. */
export const FECHA_REVISION = '23 de septiembre de 2026'

/**
 * Escotilla de desarrollo: abre la ventana aunque no sea septiembre.
 *
 * Sin esto no hay forma de probar el formulario antes del 4 de septiembre, que
 * es justo cuando ya no se puede probar nada. En Convex se activa con
 * `npx convex env set VENTANA_SIEMPRE_ABIERTA true`; en el cliente con
 * VITE_VENTANA_SIEMPRE_ABIERTA en .env.local.
 *
 * NO la actives en producción: dejaría entrar registros fuera de la
 * convocatoria y el Consejo estaría calificando gente que llegó en octubre.
 */
function ventanaForzada(): boolean {
  if (typeof process !== 'undefined' && process.env?.VENTANA_SIEMPRE_ABIERTA === 'true') {
    return true
  }
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env
    if (env?.VITE_VENTANA_SIEMPRE_ABIERTA === 'true') return true
  } catch {
    // import.meta.env no existe en todos los runtimes; no pasa nada.
  }
  return false
}

export function ventanaAbierta(ahora: number = Date.now()): boolean {
  if (ventanaForzada()) return true
  return ahora >= APERTURA_MS && ahora <= CIERRE_MS
}

/**
 * Edad cumplida en una fecha dada. Se usa una sola vez, al crear la cuenta:
 * `esMenorAlRegistrarse` se congela y no se recalcula, para que nadie deje de
 * ser menor a mitad del proceso y se pierda el rastro del consentimiento.
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
