import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { CICLO_ACTUAL, CIERRE_MS } from './lib/ciclo'
import { exigirUsuario, nuevoToken } from './users'

/** Espera mínima entre reenvíos, para no quemar la reputación del dominio. */
const ESPERA_REENVIO_MS = 5 * 60 * 1000

/**
 * Resuelve el token del enlace del correo. Pública a propósito: quien lo abre
 * es el tutor, que no tiene cuenta. El token es la credencial.
 */
export const verSolicitud = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query('tutorAuth')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!auth) return { estado: 'invalido' as const }
    if (auth.confirmadoEn !== undefined) return { estado: 'ya_confirmado' as const }
    if (Date.now() > auth.expiraEn) return { estado: 'vencido' as const }

    const atleta = await ctx.db.get(auth.userId)
    return {
      estado: 'pendiente' as const,
      tutorNombre: auth.tutorNombre,
      atletaNombre: atleta?.nombre ?? 'la persona registrada',
    }
  },
})

/**
 * El tutor autoriza. Un solo uso.
 *
 * Nunca se auto-rechaza un registro por falta de autorización — si el enlace
 * vence, lo resuelve una persona. Ver docs/DECISIONES.md.
 */
export const confirmar = mutation({
  args: { token: v.string(), agente: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query('tutorAuth')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!auth) return { ok: false as const, motivo: 'invalido' as const }
    if (auth.confirmadoEn !== undefined) return { ok: true as const, motivo: 'ya_confirmado' as const }
    if (Date.now() > auth.expiraEn) return { ok: false as const, motivo: 'vencido' as const }

    await ctx.db.patch(auth._id, {
      confirmadoEn: Date.now(),
      confirmadoDesde: args.agente,
    })

    const atleta = await ctx.db.get(auth.userId)
    return { ok: true as const, motivo: 'confirmado' as const, atletaNombre: atleta?.nombre }
  },
})

/** El atleta reenvía el correo a su tutor desde su panel. */
export const reenviar = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await exigirUsuario(ctx)

    const auth = await ctx.db
      .query('tutorAuth')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    if (!auth) throw new Error('Esta cuenta no requiere autorización de tutor.')
    if (auth.confirmadoEn !== undefined) return { ok: true as const, motivo: 'ya_confirmado' as const }

    const ahora = Date.now()
    if (ahora - auth.enviadoEn < ESPERA_REENVIO_MS) {
      return { ok: false as const, motivo: 'espera' as const, disponibleEn: auth.enviadoEn + ESPERA_REENVIO_MS }
    }

    // Token nuevo en cada reenvío: el anterior deja de servir.
    const token = nuevoToken()
    await ctx.db.patch(auth._id, {
      token,
      expiraEn: CIERRE_MS,
      enviadoEn: ahora,
      vecesEnviado: auth.vecesEnviado + 1,
    })

    await ctx.scheduler.runAfter(0, internal.emails.enviarAutorizacionTutor, {
      para: auth.tutorEmail,
      tutorNombre: auth.tutorNombre,
      atletaNombre: user.nombre ?? user.email,
      token,
      esReenvio: true,
    })

    return { ok: true as const, motivo: 'enviado' as const }
  },
})

/** El atleta corrige el correo del tutor (se escribió mal, rebotó, etc.). */
export const corregirCorreoTutor = mutation({
  args: { tutorNombre: v.string(), tutorEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await exigirUsuario(ctx)

    const auth = await ctx.db
      .query('tutorAuth')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    if (!auth) throw new Error('Esta cuenta no requiere autorización de tutor.')
    if (auth.confirmadoEn !== undefined) throw new Error('La autorización ya fue confirmada.')

    const token = nuevoToken()
    await ctx.db.patch(auth._id, {
      tutorNombre: args.tutorNombre.trim(),
      tutorEmail: args.tutorEmail.trim().toLowerCase(),
      token,
      expiraEn: CIERRE_MS,
      enviadoEn: Date.now(),
      vecesEnviado: auth.vecesEnviado + 1,
    })

    await ctx.scheduler.runAfter(0, internal.emails.enviarAutorizacionTutor, {
      para: args.tutorEmail.trim().toLowerCase(),
      tutorNombre: args.tutorNombre.trim(),
      atletaNombre: user.nombre ?? user.email,
      token,
      esReenvio: false,
    })

    return { ok: true as const }
  },
})
