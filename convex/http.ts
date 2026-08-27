import { httpRouter } from 'convex/server'
import { Webhook } from 'svix'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { resend } from './emails'

const http = httpRouter()

type ClerkEvent = {
  type: string
  data: {
    id: string
    email_addresses?: Array<{
      id: string
      email_address: string
      verification?: { status?: string } | null
    }>
    primary_email_address_id?: string | null
    first_name?: string | null
    last_name?: string | null
    public_metadata?: Record<string, unknown> | null
    unsafe_metadata?: Record<string, unknown> | null
  }
}

/** Correo primario y si Clerk ya lo verificó. */
function correoPrimario(data: ClerkEvent['data']): { email: string; verificado: boolean } {
  const lista = data.email_addresses ?? []
  const principal = lista.find((e) => e.id === data.primary_email_address_id) ?? lista[0]
  return {
    email: principal?.email_address ?? '',
    verificado: principal?.verification?.status === 'verified',
  }
}

function nombreCompleto(data: ClerkEvent['data']): string | undefined {
  const n = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
  return n || undefined
}

/** El rol vive en Clerk publicMetadata y aquí solo se espeja. */
function rol(data: ClerkEvent['data']): 'atleta' | 'admin' {
  return data.public_metadata?.role === 'admin' ? 'admin' : 'atleta'
}

function texto(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/**
 * Webhook de Clerk. Es la única forma en que un usuario llega a Convex.
 *
 * Se eligió webhook y no upsert perezoso a propósito: quien se da de alta el 5
 * de septiembre y nunca vuelve deja rastro igual, y esa es justo la lista a la
 * que XUNTAS querrá escribirle antes del cierre.
 */
http.route({
  path: '/clerk-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET
    if (!secret) {
      console.error('Falta CLERK_WEBHOOK_SECRET en el entorno de Convex.')
      return new Response('Webhook no configurado', { status: 500 })
    }

    const svixId = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Faltan encabezados svix', { status: 400 })
    }

    const cuerpo = await req.text()

    let evento: ClerkEvent
    try {
      evento = new Webhook(secret).verify(cuerpo, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkEvent
    } catch {
      return new Response('Firma inválida', { status: 400 })
    }

    switch (evento.type) {
      case 'user.created': {
        const { email, verificado } = correoPrimario(evento.data)
        const meta = evento.data.unsafe_metadata ?? {}
        await ctx.runMutation(internal.users.alta, {
          clerkId: evento.data.id,
          email,
          nombre: nombreCompleto(evento.data),
          emailVerificado: verificado,
          role: rol(evento.data),
          // Los deja el filtro de edad al momento del alta.
          fechaNacimiento: texto(meta.fechaNacimiento),
          tutorNombre: texto(meta.tutorNombre),
          tutorEmail: texto(meta.tutorEmail)?.toLowerCase(),
        })
        break
      }
      case 'user.updated': {
        const { email, verificado } = correoPrimario(evento.data)
        await ctx.runMutation(internal.users.actualizar, {
          clerkId: evento.data.id,
          email,
          nombre: nombreCompleto(evento.data),
          emailVerificado: verificado,
          role: rol(evento.data),
        })
        break
      }
      case 'user.deleted': {
        await ctx.runMutation(internal.users.baja, { clerkId: evento.data.id })
        break
      }
      default:
        break
    }

    return new Response(null, { status: 200 })
  }),
})

/** Estados de entrega de Resend (entregado, rebote, queja). */
http.route({
  path: '/resend-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req)
  }),
})

export default http
