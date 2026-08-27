import { v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { CICLO_ACTUAL, CIERRE_MS, esMenorDeEdad, fechaNacimientoValida } from './lib/ciclo'
import { correoValido } from './lib/html'
import { nuevoToken } from './lib/tokens'
import { vRole } from './schema'

export { nuevoToken }



/** Usuario autenticado, o null. Nunca lanza — la UI decide qué mostrar. */
export async function usuarioActual(ctx: QueryCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique()
}

/** Igual que `usuarioActual`, pero exige sesión. Para mutations. */
export async function exigirUsuario(ctx: QueryCtx): Promise<Doc<'users'>> {
  const user = await usuarioActual(ctx)
  if (!user) throw new Error('No hay sesión iniciada.')
  return user
}

export async function exigirAdmin(ctx: QueryCtx): Promise<Doc<'users'>> {
  const user = await exigirUsuario(ctx)
  if (user.role !== 'admin') throw new Error('Se requiere rol de administrador.')
  return user
}

/**
 * Estado completo de la cuenta para el panel del atleta: los tres ejes juntos.
 * Es la única consulta que necesita la pantalla "mi registro".
 */
export const miEstado = query({
  args: {},
  handler: async (ctx) => {
    const user = await usuarioActual(ctx)
    if (!user) return null

    const tutor = await ctx.db
      .query('tutorAuth')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    const registro = await ctx.db
      .query('registros')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    return {
      cuenta: {
        nombre: user.nombre,
        email: user.email,
        emailVerificado: user.emailVerificado,
        role: user.role,
        /**
         * `false` significa que la cuenta se creó sin pre-alta válida y no
         * sabemos su edad. NO significa mayor de edad — esa confusión era
         * justo el hueco: una cuenta sin fecha pasaba por adulta y nunca se
         * le pedía autorización del tutor.
         */
        edadDeclarada: user.fechaNacimiento !== undefined,
        esMenor: user.esMenorAlRegistrarse ?? false,
      },
      tutor: tutor
        ? {
            requerido: true,
            confirmado: tutor.confirmadoEn !== undefined,
            tutorEmail: tutor.tutorEmail,
            tutorNombre: tutor.tutorNombre,
            vecesEnviado: tutor.vecesEnviado,
            enviadoEn: tutor.enviadoEn,
          }
        : { requerido: false, confirmado: true as const },
      registro: registro
        ? {
            estado: registro.estado,
            enviadoEn: registro.enviadoEn,
            actualizadoEn: registro.actualizadoEn,
          }
        : null,
    }
  },
})

/**
 * Crea la solicitud de autorización del tutor y programa el correo.
 *
 * Es idempotente por (usuario, ciclo): si ya existe una, no manda otra. Lo
 * llaman el alta y el camino de recuperación, y Svix reintenta los webhooks.
 */
async function abrirAutorizacionTutor(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    tutorNombre: string
    tutorEmail: string
    atletaNombre: string
  },
): Promise<void> {
  const yaExiste = await ctx.db
    .query('tutorAuth')
    .withIndex('by_user_ciclo', (q) => q.eq('userId', args.userId).eq('ciclo', CICLO_ACTUAL))
    .unique()
  if (yaExiste) return

  const ahora = Date.now()
  const token = nuevoToken()
  await ctx.db.insert('tutorAuth', {
    userId: args.userId,
    ciclo: CICLO_ACTUAL,
    tutorNombre: args.tutorNombre,
    tutorEmail: args.tutorEmail,
    token,
    expiraEn: CIERRE_MS,
    enviadoEn: ahora,
    vecesEnviado: 1,
  })
  await ctx.scheduler.runAfter(0, internal.emails.enviarAutorizacionTutor, {
    para: args.tutorEmail,
    tutorNombre: args.tutorNombre,
    atletaNombre: args.atletaNombre,
    token,
    esReenvio: false,
  })
}

/**
 * Alta desde el webhook `user.created` de Clerk.
 *
 * La fecha de nacimiento y los datos del tutor NO vienen del webhook: vienen de
 * la pre-alta que `/empezar` creó en el servidor, y por Clerk solo viaja su
 * token. `unsafeMetadata` lo puede reescribir el cliente, así que lo único que
 * puede falsificar es qué pre-alta usar — y solo puede usar una que él mismo
 * creó, con la edad que el servidor ya calculó.
 *
 * Si no hay token, o venció, la cuenta se crea IGUAL pero sin fecha: queda con
 * la edad sin declarar y no puede enviar registro hasta resolverlo desde su
 * panel. Antes, esa misma situación pasaba por mayor de edad en silencio.
 */
export const alta = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    nombre: v.optional(v.string()),
    emailVerificado: v.boolean(),
    role: vRole,
    preAltaToken: v.optional(v.string()),
  },
  // Anotado a propósito: el handler llama a `internal.preAltas.consumir`, cuyo
  // tipo pasa por `_generated/api`, que a su vez incluye a esta función. Sin la
  // anotación TypeScript no puede resolver el ciclo y ambas quedan en `any`.
  handler: async (ctx, args): Promise<Id<'users'>> => {
    const existente = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    const ahora = Date.now()

    if (existente) {
      await ctx.db.patch(existente._id, {
        email: args.email,
        nombre: args.nombre ?? existente.nombre,
        emailVerificado: args.emailVerificado,
        role: args.role,
        actualizadoEn: ahora,
      })
      return existente._id
    }

    const preAlta = args.preAltaToken
      ? await ctx.runMutation(internal.preAltas.consumir, {
          token: args.preAltaToken,
          clerkId: args.clerkId,
        })
      : null

    if (!preAlta) {
      console.warn(
        `[alta] cuenta ${args.clerkId} creada sin pre-alta válida. ` +
          'Queda con la edad sin declarar hasta que la complete desde su panel.',
      )
    }

    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      nombre: args.nombre,
      role: args.role,
      emailVerificado: args.emailVerificado,
      fechaNacimiento: preAlta?.fechaNacimiento,
      esMenorAlRegistrarse: preAlta?.esMenor,
      creadoEn: ahora,
      actualizadoEn: ahora,
    })

    // Menor de edad: sale el correo al tutor de inmediato. No bloquea el alta,
    // pero la cuenta queda incompleta hasta que confirme.
    if (preAlta?.esMenor && preAlta.tutorEmail && preAlta.tutorNombre) {
      await abrirAutorizacionTutor(ctx, {
        userId,
        tutorNombre: preAlta.tutorNombre,
        tutorEmail: preAlta.tutorEmail,
        atletaNombre: args.nombre ?? args.email,
      })
    }

    return userId
  },
})

/**
 * Camino de recuperación para una cuenta que quedó sin fecha de nacimiento.
 *
 * Pasa cuando el alta se completó sin pre-alta válida — el caso real es el
 * rodeo por Google, donde el token puede perderse si el navegador no conserva
 * el sessionStorage. Sin esto, esas cuentas quedaban atrapadas.
 *
 * Se puede usar UNA vez: la fecha ya declarada no se cambia. Si se pudiera,
 * bastaría con declararse mayor después para deshacerse del tutor.
 */
export const declararFechaNacimiento = mutation({
  args: {
    fechaNacimiento: v.string(),
    tutorNombre: v.optional(v.string()),
    tutorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await exigirUsuario(ctx)

    if (user.fechaNacimiento !== undefined) {
      throw new Error('Tu fecha de nacimiento ya está registrada y no se puede cambiar.')
    }

    const ahora = Date.now()
    const fechaNacimiento = args.fechaNacimiento.trim()
    if (!fechaNacimientoValida(fechaNacimiento, ahora)) {
      throw new Error('Revisa tu fecha de nacimiento.')
    }

    const esMenor = esMenorDeEdad(fechaNacimiento, ahora)
    const tutorNombre = args.tutorNombre?.trim()
    const tutorEmail = args.tutorEmail?.trim().toLowerCase()

    if (esMenor) {
      if (!tutorNombre) throw new Error('Escribe el nombre de tu padre, madre o tutor.')
      if (!tutorEmail || !correoValido(tutorEmail)) {
        throw new Error('Escribe un correo válido para tu padre, madre o tutor.')
      }
    }

    await ctx.db.patch(user._id, {
      fechaNacimiento,
      esMenorAlRegistrarse: esMenor,
      actualizadoEn: ahora,
    })

    if (esMenor && tutorNombre && tutorEmail) {
      await abrirAutorizacionTutor(ctx, {
        userId: user._id,
        tutorNombre,
        tutorEmail,
        atletaNombre: user.nombre ?? user.email,
      })
    }

    return { ok: true as const, esMenor }
  },
})

/** `user.updated` de Clerk. Solo espeja; no toca el registro ni al tutor. */
export const actualizar = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    nombre: v.optional(v.string()),
    emailVerificado: v.boolean(),
    role: vRole,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()
    if (!user) return
    await ctx.db.patch(user._id, {
      email: args.email,
      nombre: args.nombre ?? user.nombre,
      emailVerificado: args.emailVerificado,
      role: args.role,
      actualizadoEn: Date.now(),
    })
  },
})

/**
 * `user.deleted` de Clerk.
 *
 * Borrado real, no lógico: si alguien ejerce su derecho de cancelación bajo la
 * LFPDPPP, sus datos se van de verdad, incluido el registro y el rastro del
 * tutor.
 */
export const baja = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()
    if (!user) return

    const registros = await ctx.db
      .query('registros')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id))
      .collect()
    for (const r of registros) await ctx.db.delete(r._id)

    const tutores = await ctx.db
      .query('tutorAuth')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id))
      .collect()
    for (const t of tutores) await ctx.db.delete(t._id)

    await ctx.db.delete(user._id)
  },
})
