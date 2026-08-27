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

/** America/Mexico_City es UTC-6 todo el año desde 2022. */
const OFFSET_MX_MS = 6 * 60 * 60 * 1000

/** Fecha `yyyy-mm-dd` a sus tres números. `null` si no tiene esa forma. */
function partesISO(iso: string): { anio: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  // Rebota 31 de febrero y compañía.
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null
  }
  return { anio, mes, dia }
}

export function fechaNacimientoValida(iso: string, ahora: number = Date.now()): boolean {
  const p = partesISO(iso)
  if (!p) return false
  const ms = Date.UTC(p.anio, p.mes - 1, p.dia)
  if (ms > ahora) return false
  if (p.anio < 1930) return false
  return true
}

/**
 * Edad cumplida en una fecha dada. Se usa una sola vez, al crear la cuenta:
 * `esMenorAlRegistrarse` se congela y no se recalcula, para que nadie deje de
 * ser menor a mitad del proceso y se pierda el rastro del consentimiento.
 *
 * El "hoy" se resuelve en hora del centro de México, no en UTC. Con UTC, quien
 * cumple 18 años hoy pasaba a contar como mayor desde las 18:00 de ayer, hora
 * local — seis horas en las que el sistema decidía distinto que la ley.
 *
 * Devuelve -1 si la fecha no es una `yyyy-mm-dd` válida, para que quien llame
 * no confunda "no sé" con "recién nacido".
 */
export function edadEn(fechaNacimientoISO: string, ahora: number = Date.now()): number {
  const nac = partesISO(fechaNacimientoISO)
  if (!nac) return -1

  const hoy = new Date(ahora - OFFSET_MX_MS)
  const anioHoy = hoy.getUTCFullYear()
  const mesHoy = hoy.getUTCMonth() + 1
  const diaHoy = hoy.getUTCDate()

  let edad = anioHoy - nac.anio
  if (mesHoy < nac.mes || (mesHoy === nac.mes && diaHoy < nac.dia)) edad--
  return edad
}

export function esMenorDeEdad(fechaNacimientoISO: string, ahora: number = Date.now()): boolean {
  const edad = edadEn(fechaNacimientoISO, ahora)
  // Una fecha ilegible se trata como menor: el error caro es el otro.
  if (edad < 0) return true
  return edad < 18
}
