import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { CICLO_ACTUAL, CIERRE_MS, ventanaAbierta } from './lib/ciclo'
import { exigirAdmin, exigirUsuario, usuarioActual } from './users'
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

/** Autoguardado del borrador. No valida: es un borrador. */
export const guardarBorrador = mutation({
  args: { datos: vDatosRegistro },
  handler: async (ctx, args) => {
    const user = await exigirUsuario(ctx)
    exigirVentanaAbierta()

    const existente = await ctx.db
      .query('registros')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    const ahora = Date.now()

    if (existente) {
      if (existente.estado === 'validado' || existente.estado === 'rechazado') {
        throw new Error('Tu registro ya fue revisado y no se puede editar.')
      }
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

      await ctx.scheduler.runAfter(0, internal.emails.enviarConfirmacionAtleta, {
        para: args.datos.persona.email,
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

export const validar_ = mutation({
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
