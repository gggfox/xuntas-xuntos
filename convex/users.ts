import { v } from 'convex/values'
import { internalMutation, query, type QueryCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { CICLO_ACTUAL, CIERRE_MS, esMenorDeEdad } from './lib/ciclo'
import { vRole } from './schema'

/** Token de un solo uso para el enlace del tutor. 32 hex, sin ambigüedad. */
export function nuevoToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

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
 * Alta desde el webhook `user.created` de Clerk.
 *
 * El filtro de edad guarda fechaNacimiento y (si es menor) los datos del tutor
 * en `unsafeMetadata` al momento del alta; aquí los leemos. La cuenta se crea
 * siempre — queda "en progreso" hasta que el tutor confirme.
 */
export const alta = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    nombre: v.optional(v.string()),
    emailVerificado: v.boolean(),
    role: vRole,
    fechaNacimiento: v.optional(v.string()),
    tutorNombre: v.optional(v.string()),
    tutorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existente = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    const ahora = Date.now()
    const esMenor = args.fechaNacimiento ? esMenorDeEdad(args.fechaNacimiento, ahora) : undefined

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

    const userId = await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      nombre: args.nombre,
      role: args.role,
      emailVerificado: args.emailVerificado,
      fechaNacimiento: args.fechaNacimiento,
      esMenorAlRegistrarse: esMenor,
      creadoEn: ahora,
      actualizadoEn: ahora,
    })

    // Menor de edad: se crea el registro de autorización y sale el correo al
    // tutor de inmediato. No bloquea el alta, pero la cuenta queda incompleta.
    if (esMenor && args.tutorEmail && args.tutorNombre) {
      const token = nuevoToken()
      await ctx.db.insert('tutorAuth', {
        userId,
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
        atletaNombre: args.nombre ?? args.email,
        token,
        esReenvio: false,
      })
    }

    return userId
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
