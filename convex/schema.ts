import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Ciclo actual. Todo registro y toda autorización de tutor cuelgan de un ciclo,
 * para poder correr la convocatoria otra vez en 2027 sin migrar nada.
 */
export const CICLO_ACTUAL = '2026-2027'

/** Rama del programa. XUNTAS = femenil, XUNTOS = varonil. */
export const vRama = v.union(v.literal('femenil'), v.literal('varonil'))

/** Rol de la cuenta. Se lee de Clerk publicMetadata.role y se copia aquí. */
export const vRole = v.union(v.literal('atleta'), v.literal('admin'))

/**
 * Estado del REGISTRO (los datos), no de la cuenta ni del tutor.
 * Los tres ejes se modelan por separado a propósito — ver docs/DECISIONES.md.
 */
export const vEstadoRegistro = v.union(
  v.literal('borrador'),
  v.literal('enviado'),
  v.literal('validado'),
  v.literal('rechazado'),
)

const vResultado = v.object({
  torneo: v.string(),
  resultado: v.string(),
})

const vRanking = v.object({
  nombre: v.string(),
  posicion: v.string(),
})

const vEventoCalendario = v.object({
  evento: v.string(),
  fecha: v.string(),
})

export default defineSchema({
  /**
   * Filtro de edad resuelto EN EL SERVIDOR, antes de que exista la cuenta.
   *
   * Antes la fecha de nacimiento y los datos del tutor viajaban en
   * `unsafeMetadata` de Clerk, que el cliente puede escribir cuando quiera: se
   * podía declarar mayoría de edad y saltarse la autorización del tutor sin
   * dejar rastro. Ahora `/empezar` llama a `preAltas.crear`, el servidor calcula
   * `esMenor` y guarda el resultado aquí; por Clerk solo viaja `token`, que es
   * una referencia opaca y no lleva ningún dato personal.
   *
   * Vida corta a propósito: si el alta nunca se completa, esto guarda la fecha
   * de nacimiento de una persona menor y el correo de su tutor sin que nadie
   * haya consentido nada. `crons.ts` los borra al vencer.
   */
  preAltas: defineTable({
    token: v.string(),
    fechaNacimiento: v.string(), // ISO yyyy-mm-dd
    /** Lo calcula el servidor con `esMenorDeEdad`. El cliente no lo manda. */
    esMenor: v.boolean(),
    tutorNombre: v.optional(v.string()),
    tutorEmail: v.optional(v.string()),
    creadoEn: v.number(),
    expiraEn: v.number(),
    /** clerkId de la cuenta que lo consumió. Un solo uso. */
    usadoPor: v.optional(v.string()),
  })
    .index('by_token', ['token'])
    .index('by_expira', ['expiraEn']),

  /**
   * Espejo de la cuenta de Clerk. Lo escribe el webhook (user.created /
   * user.updated / user.deleted), nunca el cliente.
   *
   * Eje 1 de estado: la CUENTA. `emailVerificado` viene de Clerk.
   */
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    nombre: v.optional(v.string()),
    role: vRole,
    emailVerificado: v.boolean(),
    /**
     * Se captura en el filtro de edad, antes del alta en Clerk.
     *
     * `undefined` significa DESCONOCIDA, no "mayor de edad". Pasa cuando la
     * cuenta se creó sin pre-alta (por ejemplo, si se perdió el token en el
     * camino de Google). Esas cuentas no pueden enviar registro hasta que
     * declaren su fecha; ver `users.declararFechaNacimiento`.
     */
    fechaNacimiento: v.optional(v.string()), // ISO yyyy-mm-dd
    /** Derivado de fechaNacimiento al momento del alta. No se recalcula. */
    esMenorAlRegistrarse: v.optional(v.boolean()),
    creadoEn: v.number(),
    actualizadoEn: v.number(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email'])
    .index('by_role', ['role']),

  /**
   * Eje 2 de estado: AUTORIZACIÓN DEL TUTOR.
   *
   * Cuelga del USUARIO (el tutor autoriza la cuenta, no el formulario), pero
   * lleva `ciclo` para dejar rastro por convocatoria. Tabla aparte y no campo
   * anidado, para poder indexar el token y resolver el link en O(1).
   *
   * La cuenta SÍ se crea sin autorización — queda "en progreso". El registro se
   * puede enviar, pero se marca ruidosamente y nunca se auto-rechaza: lo
   * resuelve una persona.
   */
  tutorAuth: defineTable({
    userId: v.id('users'),
    ciclo: v.string(),
    tutorNombre: v.string(),
    tutorEmail: v.string(),
    /** Token de un solo uso que viaja en el correo al tutor. */
    token: v.string(),
    expiraEn: v.number(),
    confirmadoEn: v.optional(v.number()),
    /** IP/agente de quien confirmó, para el rastro de consentimiento. */
    confirmadoDesde: v.optional(v.string()),
    enviadoEn: v.number(),
    vecesEnviado: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_user_ciclo', ['userId', 'ciclo'])
    .index('by_ciclo_confirmado', ['ciclo', 'confirmadoEn']),

  /**
   * Eje 3 de estado: EL REGISTRO.
   *
   * Arreglos anidados (resultados / rankings / calendario): son pequeños,
   * siempre se leen junto con el registro y Convex los maneja de forma nativa.
   */
  registros: defineTable({
    userId: v.id('users'),
    ciclo: v.string(),

    persona: v.object({
      nombre: v.string(),
      email: v.string(),
      whatsapp: v.string(),
      fechaNacimiento: v.string(),
      rama: vRama,
      ciudadEstado: v.string(),
    }),

    academico: v.object({
      escuela: v.string(),
      grado: v.string(),
      anioGraduacion: v.optional(v.string()),
      interes: v.optional(v.string()),
    }),

    deportivo: v.object({
      club: v.string(),
      coach: v.string(),
      ghin: v.string(),
      estatusAmateur: v.boolean(),
    }),

    resultados: v.array(vResultado),
    rankings: v.array(vRanking),
    calendario: v.array(vEventoCalendario),

    cartaMotivos: v.string(),

    confirmaciones: v.object({
      bases: v.boolean(),
      becaSeOtorga: v.boolean(),
      privacidad: v.boolean(),
    }),

    estado: vEstadoRegistro,
    enviadoEn: v.optional(v.number()),
    actualizadoEn: v.number(),

    /** Validación operativa que hacen los admins de XUNTAS, al vuelo. */
    validadoPor: v.optional(v.id('users')),
    validadoEn: v.optional(v.number()),
    notaValidacion: v.optional(v.string()),
  })
    .index('by_user_ciclo', ['userId', 'ciclo'])
    .index('by_ciclo_estado', ['ciclo', 'estado'])
    .index('by_ciclo_rama', ['ciclo', 'persona.rama']),
})
