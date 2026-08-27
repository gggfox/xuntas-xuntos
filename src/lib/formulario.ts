import * as m from '../paraglide/messages.js'

export const LIMITE_CARTA = 3000

/** Los cuatro rankings que XUNTAS sigue. El quinto renglón es libre. */
export const RANKINGS_FIJOS = ['CNIJ', 'AJGA', 'Junior Scoreboard', 'WAGR'] as const

export type Fila = { a: string; b: string }

export type DatosRegistro = {
  persona: {
    nombre: string
    email: string
    whatsapp: string
    fechaNacimiento: string
    rama: 'femenil' | 'varonil'
    ciudadEstado: string
  }
  academico: {
    escuela: string
    grado: string
    anioGraduacion?: string
    interes?: string
  }
  deportivo: {
    club: string
    coach: string
    ghin: string
    estatusAmateur: boolean
  }
  resultados: Array<{ torneo: string; resultado: string }>
  rankings: Array<{ nombre: string; posicion: string }>
  calendario: Array<{ evento: string; fecha: string }>
  cartaMotivos: string
  confirmaciones: {
    bases: boolean
    becaSeOtorga: boolean
    privacidad: boolean
  }
}

export function filaVacia(): Fila {
  return { a: '', b: '' }
}

/** Arranca con tres resultados y dos eventos visibles, como el prototipo. */
export function registroVacio(semilla?: Partial<DatosRegistro['persona']>): DatosRegistro {
  return {
    persona: {
      nombre: '',
      email: '',
      whatsapp: '',
      fechaNacimiento: '',
      rama: '' as 'femenil' | 'varonil',
      ciudadEstado: '',
      ...semilla,
    },
    academico: { escuela: '', grado: '', anioGraduacion: '', interes: '' },
    deportivo: { club: '', coach: '', ghin: '', estatusAmateur: false },
    resultados: [
      { torneo: '', resultado: '' },
      { torneo: '', resultado: '' },
      { torneo: '', resultado: '' },
    ],
    rankings: RANKINGS_FIJOS.map((nombre) => ({ nombre, posicion: '' })),
    calendario: [
      { evento: '', fecha: '' },
      { evento: '', fecha: '' },
    ],
    cartaMotivos: '',
    confirmaciones: { bases: false, becaSeOtorga: false, privacidad: false },
  }
}

/**
 * Validación de cliente. Es un espejo de la del servidor (`convex/registros.ts`)
 * para dar retroalimentación rápida — la que manda es la del servidor.
 */
export function validarRegistro(d: DatosRegistro): string[] {
  const e: string[] = []

  if (!d.persona.nombre.trim()) e.push(m.reg_nombre_error())
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.persona.email)) e.push(m.reg_email_error())
  if (!d.persona.whatsapp.trim()) e.push(m.reg_whatsapp_error())
  if (!d.persona.fechaNacimiento) e.push(m.puerta_fecha_error())
  if (d.persona.rama !== 'femenil' && d.persona.rama !== 'varonil') e.push(m.reg_rama_error())
  if (!d.persona.ciudadEstado.trim()) e.push(m.reg_ciudad_error())

  if (!d.academico.escuela.trim()) e.push(m.reg_escuela_error())
  if (!d.academico.grado.trim()) e.push(m.reg_grado_error())

  if (!d.deportivo.club.trim()) e.push(m.reg_club_error())
  if (!d.deportivo.coach.trim()) e.push(m.reg_coach_error())
  if (!d.deportivo.ghin.trim()) e.push(m.reg_ghin_error())

  if (!d.resultados.some((r) => r.torneo.trim() && r.resultado.trim())) {
    e.push(m.reg_resultados_error())
  }

  if (!d.cartaMotivos.trim()) e.push(m.reg_carta_error())

  if (!d.confirmaciones.bases) e.push(m.reg_ck_bases())
  if (!d.confirmaciones.becaSeOtorga) e.push(m.reg_ck_beca())
  if (!d.confirmaciones.privacidad) e.push(m.reg_ck_privacidad())

  return e
}

/** Limpia filas vacías y normaliza antes de mandar al servidor. */
export function paraEnviar(d: DatosRegistro): DatosRegistro {
  return {
    ...d,
    persona: { ...d.persona, email: d.persona.email.trim().toLowerCase() },
    resultados: d.resultados.filter((r) => r.torneo.trim() && r.resultado.trim()),
    rankings: d.rankings.filter((r) => r.nombre.trim() && r.posicion.trim()),
    calendario: d.calendario.filter((c) => c.evento.trim() && c.fecha.trim()),
  }
}
