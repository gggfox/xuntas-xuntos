import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { CICLO_ACTUAL, CIERRE_MS } from './lib/ciclo'
import { exigirUsuario, nuevoToken } from './users'
import { correoValido } from './lib/html'

/** Espera mínima entre reenvíos, para no quemar la reputación del dominio. */
const ESPERA_REENVIO_MS = 5 * 60 * 1000

/**
 * Tope duro de correos al tutor por ciclo. Un tutor que no contesta después de
 * diez intentos no es un problema de entrega: lo resuelve una persona.
 */
const MAX_ENVIOS = 10

const LIMITE_NOMBRE = 120

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
    if (auth.vecesEnviado >= MAX_ENVIOS) {
      return { ok: false as const, motivo: 'demasiados' as const }
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

/**
 * El atleta corrige el correo del tutor (se escribió mal, rebotó, etc.).
 *
 * Lleva el mismo freno que `reenviar`. Sin él, esta mutation era un modo de
 * mandar correos ilimitados desde el dominio de XUNTAS a cualquier dirección:
 * basta con cambiar el correo del tutor una y otra vez.
 */
export const corregirCorreoTutor = mutation({
  args: { tutorNombre: v.string(), tutorEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await exigirUsuario(ctx)

    const tutorNombre = args.tutorNombre.trim()
    const tutorEmail = args.tutorEmail.trim().toLowerCase()

    if (!tutorNombre) throw new Error('Escribe el nombre de tu tutor.')
    if (tutorNombre.length > LIMITE_NOMBRE) throw new Error('El nombre es demasiado largo.')
    if (!correoValido(tutorEmail)) throw new Error('Escribe un correo válido para tu tutor.')

    const auth = await ctx.db
      .query('tutorAuth')
      .withIndex('by_user_ciclo', (q) => q.eq('userId', user._id).eq('ciclo', CICLO_ACTUAL))
      .unique()

    if (!auth) throw new Error('Esta cuenta no requiere autorización de tutor.')
    if (auth.confirmadoEn !== undefined) throw new Error('La autorización ya fue confirmada.')

    const ahora = Date.now()
    const sinCambio = auth.tutorEmail === tutorEmail && auth.tutorNombre === tutorNombre

    // Corregir a los mismos datos es un reenvío disfrazado: mismo freno.
    if (sinCambio && ahora - auth.enviadoEn < ESPERA_REENVIO_MS) {
      return {
        ok: false as const,
        motivo: 'espera' as const,
        disponibleEn: auth.enviadoEn + ESPERA_REENVIO_MS,
      }
    }
    if (auth.vecesEnviado >= MAX_ENVIOS) {
      return { ok: false as const, motivo: 'demasiados' as const }
    }

    const token = nuevoToken()
    await ctx.db.patch(auth._id, {
      tutorNombre,
      tutorEmail,
      token,
      expiraEn: CIERRE_MS,
      enviadoEn: ahora,
      vecesEnviado: auth.vecesEnviado + 1,
    })

    await ctx.scheduler.runAfter(0, internal.emails.enviarAutorizacionTutor, {
      para: tutorEmail,
      tutorNombre,
      atletaNombre: user.nombre ?? user.email,
      token,
      esReenvio: false,
    })

    return { ok: true as const, motivo: 'enviado' as const }
  },
})
