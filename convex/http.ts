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
    /** Unread since roles moved to Convex; kept in the type so a future reader knows it arrives. */
    public_metadata?: Record<string, unknown> | null
    unsafe_metadata?: Record<string, unknown> | null
  }
}

/** Primary email and whether Clerk already verified it. */
function primaryEmail(data: ClerkEvent['data']): { email: string; verified: boolean } {
  const list = data.email_addresses ?? []
  const primary = list.find((e) => e.id === data.primary_email_address_id) ?? list[0]
  return {
    email: primary?.email_address ?? '',
    verified: primary?.verification?.status === 'verified',
  }
}

function fullName(data: ClerkEvent['data']): string | undefined {
  const n = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
  return n || undefined
}

function text(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/**
 * Clerk webhook. It is the only way a user gets into Convex.
 *
 * Webhook and not lazy upsert was chosen on purpose: whoever signs up on
 * September 5 and never comes back leaves a trace anyway, and that is exactly
 * the list XUNTAS will want to write to before the close.
 */
http.route({
  path: '/clerk-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET
    if (!secret) {
      console.error('Missing CLERK_WEBHOOK_SECRET in the Convex environment.')
      return new Response('Webhook not configured', { status: 500 })
    }

    const svixId = req.headers.get('svix-id')
    const svixTimestamp = req.headers.get('svix-timestamp')
    const svixSignature = req.headers.get('svix-signature')
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing svix headers', { status: 400 })
    }

    const body = await req.text()

    let event: ClerkEvent
    try {
      event = new Webhook(secret).verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkEvent
    } catch {
      return new Response('Invalid signature', { status: 400 })
    }

    switch (event.type) {
      case 'user.created': {
        const { email, verified } = primaryEmail(event.data)
        const meta = event.data.unsafe_metadata ?? {}
        await ctx.runMutation(internal.users.create, {
          clerkId: event.data.id,
          email,
          name: fullName(event.data),
          emailVerified: verified,
          /**
           * The ONLY thing read from `unsafeMetadata`, and on purpose: it is
           * an opaque reference to the pre-signup the server already resolved.
           *
           * `unsafeMetadata` can be written by the client at any time. The
           * birth date and the guardian's email used to come through here, so
           * editing it was enough to declare yourself of legal age and skip
           * the authorization. Now the worst you can do is point to another
           * pre-signup of your own, which the server also computed.
           */
          preSignupToken: text(meta.preSignupToken),
        })
        break
      }
      case 'user.updated': {
        const { email, verified } = primaryEmail(event.data)
        await ctx.runMutation(internal.users.update, {
          clerkId: event.data.id,
          email,
          name: fullName(event.data),
          emailVerified: verified,
        })
        break
      }
      case 'user.deleted': {
        await ctx.runMutation(internal.users.remove, { clerkId: event.data.id })
        break
      }
      default:
        break
    }

    return new Response(null, { status: 200 })
  }),
})

/** Resend delivery statuses (delivered, bounce, complaint). */
http.route({
  path: '/resend-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req)
  }),
})

export default http
