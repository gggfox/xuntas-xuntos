import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { CICLO_ACTUAL, CIERRE_MS, ventanaAbierta } from './lib/ciclo'
import { exigirAdmin, exigirUsuario, usuarioActual } from './users'
import type { Doc } from './_generated/dataModel'
import { vRama } from './schema'

/**
 * Payload del formulario. Mismos campos que registro_xuntas.html — esa forma
 * ya la aprobó XUNTAS y no la cambiamos.
 */
const vDatosRegistro = v.object({
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
  resultados: v.array(v.object({ torneo: v.string(), resultado: v.string() })),
  rankings: v.array(v.object({ nombre: v.string(), posicion: v.string() })),
  calendario: v.array(v.object({ evento: v.string(), fecha: v.string() })),
  cartaMotivos: v.string(),
  confirmaciones: v.object({
    bases: v.boolean(),
    becaSeOtorga: v.boolean(),
    privacidad: v.boolean(),
  }),
})

const LIMITE_CARTA = 3000

/** Topes del borrador. Generosos: están para acotar, no para validar. */
const LIMITE_CAMPO = 500
const LIMITE_FILAS = 60

/**
 * Los campos del registro que de verdad son datos, sin la metadata (`estado`,
 * `actualizadoEn`, etc.). Es lo que se compara para decidir si hay algo que
 * escribir.
 */
const CAMPOS_DE_DATOS = [
  'persona',
  'academico',
  'deportivo',
  'resultados',
  'rankings',
  'calendario',
  'cartaMotivos',
  'confirmaciones',
] as const

function sinCambios(
  existente: Doc<'registros'>,
  datos: typeof vDatosRegistro.type,
): boolean {
  return CAMPOS_DE_DATOS.every(
    (campo) => JSON.stringify(existente[campo]) === JSON.stringify(datos[campo]),
  )
}

/**
 * Un borrador no pasa por `validar`, así que sin esto se podría guardar un
 * documento arbitrariamente grande hasta toparse con el límite de 1 MB de
 * Convex — y el error saldría como una falla opaca a media captura.
 */
function exigirTamanosRazonables(datos: typeof vDatosRegistro.type) {
  if (datos.cartaMotivos.length > LIMITE_CARTA) {
    throw new Error(`La carta excede el máximo de ${LIMITE_CARTA} caracteres.`)
  }
  if (
    datos.resultados.length > LIMITE_FILAS ||
    datos.rankings.length > LIMITE_FILAS ||
    datos.calendario.length > LIMITE_FILAS
  ) {
    throw new Error(`No se pueden registrar más de ${LIMITE_FILAS} renglones por sección.`)
  }

  const textos = [
    ...Object.values(datos.persona),
    ...Object.values(datos.academico),
    ...Object.values(datos.deportivo),
    ...datos.resultados.flatMap((r) => [r.torneo, r.resultado]),
    ...datos.rankings.flatMap((r) => [r.nombre, r.posicion]),
    ...datos.calendario.flatMap((c) => [c.evento, c.fecha]),
  ]
  for (const t of textos) {
    if (typeof t === 'string' && t.length > LIMITE_CAMPO) {
      throw new Error(`Hay un campo con más de ${LIMITE_CAMPO} caracteres.`)
    }
  }
}

/** Congelado tras el cierre de la ventana. Vale para borrador y para enviado. */
function exigirVentanaAbierta() {
  if (!ventanaAbierta()) {
    throw new Error('El periodo de registro está cerrado. Cerró el 18 de septiembre de 2026.')
  }
}

/** Validación de servidor. El cliente valida también, pero no se le cree. */
function validar(datos: typeof vDatosRegistro.type): string[] {
  const errores: string[] = []
  const { persona, academico, deportivo, resultados, cartaMotivos, confirmaciones } = datos

  if (!persona.nombre.trim()) errores.push('Escribe tu nombre completo.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(persona.email)) errores.push('Escribe un correo válido.')
  if (!persona.whatsapp.trim()) errores.push('Escribe un número de contacto.')
  if (!persona.fechaNacimiento) errores.push('Indica tu fecha de nacimiento.')
  if (!persona.ciudadEstado.trim()) errores.push('Indica dónde resides.')

  if (!academico.escuela.trim()) errores.push('Indica dónde estudias.')
  if (!academico.grado.trim()) errores.push('Indica tu grado.')

  if (!deportivo.club.trim()) errores.push('Indica tu club o academia.')
  if (!deportivo.coach.trim()) errores.push('Indica quién es tu coach.')
  if (!deportivo.ghin.trim()) errores.push('Indica tu índice GHIN vigente o equivalente.')

  if (!resultados.some((r) => r.torneo.trim() && r.resultado.trim())) {
    errores.push('Registra al menos un resultado.')
  }

  if (!cartaMotivos.trim()) errores.push('Escribe tu carta de motivos.')
  if (cartaMotivos.length > LIMITE_CARTA) {
    errores.push(`La carta excede el máximo de ${LIMITE_CARTA.toLocaleString('es-MX')} caracteres.`)
  }

  if (!confirmaciones.bases) errores.push('Debes aceptar las bases de la convocatoria.')
  if (!confirmaciones.becaSeOtorga) errores.push('Debes confirmar que entiendes cómo se otorga la beca.')
  if (!confirmaciones.privacidad) errores.push('Debes aceptar el aviso de privacidad.')

  return errores
}

/** El registro del usuario en sesión, con la ventana y el bloqueo resueltos. */
export const mio = query({
  args: {},
  handler: async (ctx) => {
    const user = await usuarioActual(ctx)
    if (!user) return null

    const registro = await ctx.db
      .query('registros')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    return {
      registro,
      editable: ventanaAbierta(),
      cierraEn: CIERRE_MS,
    }
  },
})

/**
 * Autoguardado del borrador. No valida los campos: es un borrador. Sí acota los
 * tamaños, porque un documento de Convex tiene un tope de 1 MB y esto se
 * escribe sin pasar por `validar`.
 */
export const guardarBorrador = mutation({
  args: { datos: vDatosRegistro },
  handler: async (ctx, args) => {
    const user = await exigirUsuario(ctx)
    exigirVentanaAbierta()
    exigirTamanosRazonables(args.datos)

    const existente = await ctx.db
      .query('registros')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    const ahora = Date.now()

    if (existente) {
      if (existente.estado === 'validado' || existente.estado === 'rechazado') {
        throw new Error('Tu registro ya fue revisado y no se puede editar.')
      }

      // Sin cambios, sin escritura.
      //
      // No es solo ahorro: `actualizadoEn` cambia el documento, eso invalida la
      // query reactiva que alimenta la pantalla, la pantalla se vuelve a
      // renderizar y el autoguardado se vuelve a disparar. El cliente ya corta
      // ese ciclo; esto lo corta también aquí, para que una pestaña vieja o un
      // cliente con un bug no puedan reabrirlo.
      if (sinCambios(existente, args.datos)) return existente._id

      await ctx.db.patch(existente._id, { ...args.datos, actualizadoEn: ahora })
      return existente._id
    }

    return await ctx.db.insert('registros', {
      userId: user._id,
      ciclo: CICLO_ACTUAL,
      ...args.datos,
      estado: 'borrador',
      actualizadoEn: ahora,
    })
  },
})

/**
 * Envío. Valida en serio y dispara la confirmación.
 *
 * Se permite enviar aunque falte la autorización del tutor: el registro queda
 * marcado y lo resuelve una persona. Nunca se auto-rechaza a un menor porque
 * su madre o padre no abrió un correo.
 */
export const enviar = mutation({
  args: { datos: vDatosRegistro },
  handler: async (ctx, args) => {
    const user = await exigirUsuario(ctx)
    exigirVentanaAbierta()
    exigirTamanosRazonables(args.datos)

    /**
     * Sin fecha de nacimiento no se envía. Es el respaldo del filtro de edad:
     * si la cuenta se creó sin pre-alta válida, no sabemos si hace falta la
     * autorización de un tutor, y un registro de una persona menor sin ese
     * consentimiento no debe entrar. La pantalla ya pide la fecha antes de
     * llegar aquí; esto existe por si alguien llama a la mutation directo.
     */
    if (user.fechaNacimiento === undefined) {
      return {
        ok: false as const,
        errores: ['Antes de enviar tu registro necesitamos tu fecha de nacimiento.'],
      }
    }

    const errores = validar(args.datos)
    if (errores.length > 0) return { ok: false as const, errores }

    const existente = await ctx.db
      .query('registros')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    if (existente && (existente.estado === 'validado' || existente.estado === 'rechazado')) {
      throw new Error('Tu registro ya fue revisado y no se puede editar.')
    }

    const ahora = Date.now()
    const campos = {
      ...args.datos,
      estado: 'enviado' as const,
      enviadoEn: existente?.enviadoEn ?? ahora,
      actualizadoEn: ahora,
    }

    if (existente) {
      await ctx.db.patch(existente._id, campos)
    } else {
      await ctx.db.insert('registros', { userId: user._id, ciclo: CICLO_ACTUAL, ...campos })
    }

    // Solo se confirma el primer envío; las ediciones posteriores no re-envían.
    const esPrimerEnvio = !existente || existente.estado !== 'enviado'
    if (esPrimerEnvio) {
      const tutor = await ctx.db
        .query('tutorAuth')
        .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
        .unique()

      // Va al correo de la CUENTA, que Clerk ya verificó — no al que se
      // escribió en el formulario. Si fuera al del formulario, cualquier
      // persona con sesión podría hacer que registro@xuntas.org le mande un
      // correo a la dirección que quisiera.
      await ctx.scheduler.runAfter(0, internal.emails.enviarConfirmacionAtleta, {
        para: user.email,
        nombre: args.datos.persona.nombre,
        faltaTutor: tutor !== null && tutor.confirmadoEn === undefined,
      })
    }

    return { ok: true as const, errores: [] as string[] }
  },
})

// ---------------------------------------------------------------------------
// Administración. La UI de tabla llega después del lanzamiento; estas
// funciones existen para que los admins de XUNTAS puedan validar al vuelo.
// ---------------------------------------------------------------------------

export const listarParaAdmin = query({
  args: { estado: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await exigirAdmin(ctx)

    const registros = args.estado
      ? await ctx.db
          .query('registros')
          .withIndex('by_ciclo_estado', (q) => q.eq('ciclo', CICLO_ACTUAL).eq('estado', args.estado as never))
          .collect()
      : await ctx.db
          .query('registros')
          .withIndex('by_user_ciclo', (q) => q)
          .filter((q) => q.eq(q.field('ciclo'), CICLO_ACTUAL))
          .collect()

    return await Promise.all(
      registros.map(async (r) => {
        const tutor = await ctx.db
          .query('tutorAuth')
          .withIndex('by_user_ciclo', (q) => q.eq('userId', r.userId).eq('ciclo', CICLO_ACTUAL))
          .unique()
        return {
          ...r,
          tutorRequerido: tutor !== null,
          tutorConfirmado: tutor === null || tutor.confirmadoEn !== undefined,
        }
      }),
    )
  },
})

export const revisar = mutation({
  args: {
    registroId: v.id('registros'),
    estado: v.union(v.literal('validado'), v.literal('rechazado')),
    nota: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await exigirAdmin(ctx)
    await ctx.db.patch(args.registroId, {
      estado: args.estado,
      validadoPor: admin._id,
      validadoEn: Date.now(),
      notaValidacion: args.nota,
    })
  },
})
