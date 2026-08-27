import { v } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import { esMenorDeEdad, fechaNacimientoValida } from './lib/ciclo'
import { correoValido } from './lib/html'
import { nuevoToken } from './lib/tokens'

/**
 * Filtro de edad, resuelto en el servidor antes de que exista la cuenta.
 *
 * El navegador nunca decide si alguien es menor de edad ni guarda su fecha de
 * nacimiento: manda la fecha una vez, el servidor calcula `esMenor`, y de
 * vuelta solo viaja un token opaco. Ese token es lo único que pasa por
 * `unsafeMetadata` de Clerk — que el cliente puede reescribir, y por eso ya no
 * lleva nada que importe.
 */

/**
 * Dos horas. Es de sobra para crear una cuenta (incluido el rodeo por Google) y
 * es poco para tener guardada la fecha de nacimiento de una menor y el correo
 * de su tutor sin que nadie haya consentido todavía.
 */
const VIGENCIA_MS = 2 * 60 * 60 * 1000

const LIMITE_NOMBRE = 120

export const crear = mutation({
  args: {
    fechaNacimiento: v.string(),
    tutorNombre: v.optional(v.string()),
    tutorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ahora = Date.now()
    const fechaNacimiento = args.fechaNacimiento.trim()

    if (!fechaNacimientoValida(fechaNacimiento, ahora)) {
      throw new Error('Revisa tu fecha de nacimiento.')
    }

    // LA decisión. Se toma aquí y en ningún otro lado.
    const esMenor = esMenorDeEdad(fechaNacimiento, ahora)

    const tutorNombre = args.tutorNombre?.trim()
    const tutorEmail = args.tutorEmail?.trim().toLowerCase()

    if (esMenor) {
      if (!tutorNombre) throw new Error('Escribe el nombre de tu padre, madre o tutor.')
      if (tutorNombre.length > LIMITE_NOMBRE) throw new Error('El nombre es demasiado largo.')
      if (!tutorEmail || !correoValido(tutorEmail)) {
        throw new Error('Escribe un correo válido para tu padre, madre o tutor.')
      }
    }

    const token = nuevoToken()
    await ctx.db.insert('preAltas', {
      token,
      fechaNacimiento,
      esMenor,
      // Si no es menor no se guarda nada del tutor, aunque lo hayan mandado.
      tutorNombre: esMenor ? tutorNombre : undefined,
      tutorEmail: esMenor ? tutorEmail : undefined,
      creadoEn: ahora,
      expiraEn: ahora + VIGENCIA_MS,
    })

    // `esMenor` se devuelve solo para que la pantalla siguiente sepa qué decir.
    // Quien manda es la fila que acabamos de escribir.
    return { token, esMenor }
  },
})

/**
 * Lo consume el webhook `user.created`. Un solo uso: si el mismo token llega
 * dos veces (Svix reintenta), la segunda no encuentra nada que consumir y el
 * alta sigue su camino sin duplicar la solicitud al tutor.
 */
/** Lo que el alta necesita saber de una pre-alta ya resuelta. */
export type PreAltaResuelta = {
  fechaNacimiento: string
  esMenor: boolean
  tutorNombre?: string
  tutorEmail?: string
}

export const consumir = internalMutation({
  args: { token: v.string(), clerkId: v.string() },
  // Anotado a propósito: sin esto, `users.alta` lo llama, el tipo pasa por
  // `_generated/api` y TypeScript se queda sin poder inferir ninguno de los dos.
  handler: async (ctx, args): Promise<PreAltaResuelta | null> => {
    const preAlta = await ctx.db
      .query('preAltas')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!preAlta) return null
    if (preAlta.usadoPor !== undefined && preAlta.usadoPor !== args.clerkId) return null
    if (Date.now() > preAlta.expiraEn) return null

    if (preAlta.usadoPor === undefined) {
      await ctx.db.patch(preAlta._id, { usadoPor: args.clerkId })
    }

    return {
      fechaNacimiento: preAlta.fechaNacimiento,
      esMenor: preAlta.esMenor,
      tutorNombre: preAlta.tutorNombre,
      tutorEmail: preAlta.tutorEmail,
    }
  },
})

/**
 * Barrido de pre-altas vencidas. Lo corre el cron.
 *
 * Son datos personales de menores que nadie llegó a usar. No hay razón para
 * conservarlos y sí hay razón para no hacerlo.
 */
export const limpiar = internalMutation({
  args: {},
  handler: async (ctx) => {
    const vencidas = await ctx.db
      .query('preAltas')
      .withIndex('by_expira', (q) => q.lt('expiraEn', Date.now()))
      .take(500)

    for (const p of vencidas) await ctx.db.delete(p._id)

    if (vencidas.length > 0) {
      console.log(`[preAltas] borradas ${vencidas.length} pre-altas vencidas`)
    }
    return vencidas.length
  },
})
