import { Resend, vOnEmailEventArgs } from '@convex-dev/resend'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { textForEmail } from './lib/html'
import { titleOf } from './lib/cycleRules'

/**
 * Resend client with durable execution: queue, retries and idempotency. It
 * matters for the guardian email — if Resend is down, the email is sent when
 * it comes back, not lost.
 *
 * testMode:false sends to real addresses. While it is true, Resend only
 * accepts @resend.dev.
 */
export const resend: Resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== 'false',
  onEmailEvent: internal.emails.recordEmailEvent,
})

const FROM = 'XUNTAS+XUNTOS <registro@xuntas.org>'
const REPLY_TO = 'hola@xuntas.org'

const appUrl = () => process.env.APP_URL ?? 'https://app.xuntas.org'

/**
 * The header chrome's short form of a cycle's name ("Convocatoria
 * 2026–2027") — shorter than `titleOf`'s body-copy phrasing, which spells
 * out "Convocatoria General". Derived from the cycle name we already have on
 * hand, never typed, so a new call for applications needs no email edit.
 */
function headerLineFor(cycle: string): string {
  return `Convocatoria ${cycle.replace('-', '–')}`
}

/**
 * The header chrome for mail that is not about any particular call for
 * applications — a staff invitation or a grant of panel access reads oddly
 * naming a registration cycle it has nothing to do with.
 */
const STAFF_HEADER_LINE = 'Panel de administración'

/** Shared HTML wrapper. Email = tables and inline styles, not Tailwind. */
function template(content: string, preheader: string, headerLine: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid rgba(17,17,17,.11);border-radius:10px;overflow:hidden;">
  <tr><td style="background:#111111;padding:20px 26px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:34px;height:34px;background:#EDF45F;border-radius:50%;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-weight:bold;font-size:18px;color:#111111;">X</td>
      <td style="padding-left:11px;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:16px;color:#FFFFFF;line-height:1.15;">XUNTAS&ndash;XUNTOS</div>
        <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);">${headerLine}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:30px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111111;">
    ${content}
  </td></tr>
  <tr><td style="padding:18px 26px;border-top:1px solid rgba(17,17,17,.11);font-family:'Courier New',monospace;font-size:11px;color:rgba(17,17,17,.58);">
    Este correo se envió porque alguien inició un registro en ${appUrl()}.<br>
    ¿Dudas? Responde a este mensaje.
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function button(href: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;"><tr>
    <td style="background:#EDF45F;border:1px solid #111111;border-radius:7px;">
      <a href="${href}" style="display:inline-block;padding:12px 22px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;text-decoration:none;">${text}</a>
    </td></tr></table>`
}

/**
 * Confirmation to the athlete. Fired on registration submission, not on
 * account creation — the account by itself is not a registration.
 */
export const sendAthleteConfirmation = internalMutation({
  args: {
    to: v.string(),
    name: v.string(),
    guardianMissing: v.boolean(),
    closesOnText: v.string(),
    reviewOnText: v.string(),
    cycle: v.string(),
  },
  handler: async (ctx, args) => {
    // Escaped: the name comes from the form and ends up inside the HTML.
    const firstName = textForEmail(args.name.trim().split(/\s+/)[0] || args.name, 60)
    const headerLine = headerLineFor(args.cycle)

    const guardianNotice = args.guardianMissing
      ? `<div style="background:#F8FBD4;border:1px solid #C9D42B;border-radius:9px;padding:16px 19px;margin:22px 0;">
           <b style="display:block;margin-bottom:5px;font-size:14.5px;">Falta la autorización de tu tutor</b>
           <p style="margin:0;font-size:13px;color:#3A3A3A;line-height:1.6;">
             Le enviamos un correo a tu padre, madre o tutor para que autorice tu cuenta.
             Tu registro está guardado, pero no queda completo hasta que confirme.
             Puedes reenviarle el correo desde tu panel.
           </p>
         </div>`
      : ''

    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject: `Recibimos tu registro · ${headerLine}`,
      html: template(
        `<p style="margin:0 0 14px;">Hola, ${firstName}:</p>
         <p style="margin:0 0 14px;">Tu registro al Programa de Desarrollo quedó guardado.</p>
         ${guardianNotice}
         <p style="margin:0 0 14px;"><b>Qué sigue.</b> Revisamos tu registro antes del ${textForEmail(args.reviewOnText)}.
         Puedes editar tus datos hasta el ${textForEmail(args.closesOnText)} a las 23:59, hora del centro de México.</p>
         <p style="margin:0 0 14px;">Recuerda que el registro no garantiza la admisión ni la obtención de una beca.</p>
         ${button(`${appUrl()}/es/mi-registro`, 'Ver mi registro')}`,
        'Tu registro al Programa de Desarrollo quedó guardado.',
        headerLine,
      ),
    })
  },
})

/**
 * Guardian authorization. It is the real consent to process a minor's data —
 * the checkbox the athlete ticks is not.
 */
export const sendGuardianAuthorization = internalMutation({
  args: {
    to: v.string(),
    guardianName: v.string(),
    athleteName: v.string(),
    token: v.string(),
    isResend: v.boolean(),
    closesOnText: v.string(),
    cycle: v.string(),
  },
  handler: async (ctx, args) => {
    // The token is hex we generate, but it gets encoded anyway: the URL is
    // not hand-built with data that does not come from here.
    const href = `${appUrl()}/es/autorizar/${encodeURIComponent(args.token)}`

    // The subject is plain text (no HTML escaping), but it does get truncated.
    const athleteSubject = args.athleteName.trim().replace(/\s+/g, ' ').slice(0, 60)
    const subject = args.isResend
      ? `Recordatorio: autoriza la cuenta de ${athleteSubject}`
      : `Autoriza la cuenta de ${athleteSubject} · XUNTAS+XUNTOS`

    // Escaped: both come from forms.
    const guardianName = textForEmail(args.guardianName)
    const athleteName = textForEmail(args.athleteName)
    // The full body-copy title ("Convocatoria General 2026–2027"), not the
    // header chrome's shorter form — derived, so it does not need escaping,
    // but running it through costs nothing.
    const cycleTitle = textForEmail(titleOf(args.cycle, 'es'))

    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject,
      html: template(
        `<p style="margin:0 0 14px;">Hola, ${guardianName}:</p>
         <p style="margin:0 0 14px;">
           <b>${athleteName}</b> se registró a la ${cycleTitle} del
           Programa de Desarrollo de XUNTAS+XUNTOS y te señaló como su padre, madre o tutor.
         </p>
         <p style="margin:0 0 14px;">
           Como es menor de edad, necesitamos tu autorización para crear su cuenta y tratar sus datos.
           No hay ningún documento que cargar: basta con que confirmes aquí.
         </p>
         ${button(href, 'Autorizo la cuenta')}
         <p style="margin:0 0 14px;font-size:13px;color:rgba(17,17,17,.58);">
           El enlace vence el ${textForEmail(args.closesOnText)}. Si no reconoces este registro,
           ignora este correo y responde para avisarnos: la cuenta no quedará autorizada.
         </p>`,
        `${athleteName} necesita tu autorización para completar su registro.`,
        headerLineFor(args.cycle),
      ),
    })
  },
})

/**
 * Delivery statuses Resend reports via webhook.
 *
 * A bounce of the guardian email is the most expensive failure in the system:
 * the registration looks fine and nobody finds out the authorization is never
 * going to arrive. It is logged with a stable prefix so it can be filtered in
 * the Convex logs.
 *
 * A decision notice also moves here: the review table shows delivered/bounced
 * so nobody assumes a family knows something the mail never reached them
 * with.
 */
export const recordEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (ctx, args) => {
    const type = args.event.type
    const failed = type === 'email.bounced' || type === 'email.complained'
    if (failed) {
      console.error(
        `[email] FAILURE ${type} id=${args.id} — check who it was addressed to in the Resend dashboard`,
      )
    } else if (type === 'email.delivery_delayed') {
      console.warn(`[email] delayed id=${args.id}`)
    }

    if (failed || type === 'email.delivered') {
      const r = await ctx.db
        .query('registrations')
        .withIndex('by_notice_email', (q) => q.eq('decisionNotice.emailId', args.id))
        .unique()
      if (r?.decisionNotice) {
        await ctx.db.patch(r._id, {
          decisionNotice: { ...r.decisionNotice, status: failed ? 'bounced' : 'delivered' },
        })
      }
    }
  },
})

/**
 * Role names for the two staff emails. Spanish, like the rest of the mail;
 * the panel itself is bilingual, but every email this system sends is in the
 * language the organisation writes in.
 */
const ROLE_NAMES_ES: Record<string, string> = {
  admin: 'Administración',
  master_admin: 'Administración maestra',
  coach: 'Coach',
  finance: 'Finanzas',
  health: 'Salud',
}

function roleList(roles: string[]): string {
  return roles.map((r) => textForEmail(ROLE_NAMES_ES[r] ?? r)).join(', ')
}

export const sendStaffInvitation = internalMutation({
  args: {
    to: v.string(),
    inviterName: v.string(),
    roles: v.array(v.string()),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const href = `${appUrl()}/es/invitacion/${encodeURIComponent(args.token)}`
    const inviter = textForEmail(args.inviterName)

    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject: 'Te invitaron al panel de XUNTAS+XUNTOS',
      html: template(
        `<p style="margin:0 0 14px;">Hola:</p>
         <p style="margin:0 0 14px;">
           <b>${inviter}</b> te invitó al panel de XUNTAS+XUNTOS con el rol de
           <b>${roleList(args.roles)}</b>.
         </p>
         <p style="margin:0 0 14px;">
           Crea tu cuenta con este mismo correo. No hay contraseña: entras con Google
           o con un código que te llega por correo.
         </p>
         ${button(href, 'Crear mi cuenta')}
         <p style="margin:0 0 14px;font-size:13px;color:rgba(17,17,17,.58);">
           La invitación vence en 7 días. Si no esperabas este correo, ignóralo.
         </p>`,
        'Te invitaron al panel de XUNTAS+XUNTOS.',
        STAFF_HEADER_LINE,
      ),
    })
  },
})

export const sendAccessGranted = internalMutation({
  args: { to: v.string(), roles: v.array(v.string()) },
  handler: async (ctx, args) => {
    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject: 'Ya tienes acceso al panel de XUNTAS+XUNTOS',
      html: template(
        `<p style="margin:0 0 14px;">Hola:</p>
         <p style="margin:0 0 14px;">
           Tu cuenta ahora tiene el rol de <b>${roleList(args.roles)}</b> en el panel
           de XUNTAS+XUNTOS. Entra con la cuenta que ya tienes.
         </p>
         ${button(`${appUrl()}/es/administracion`, 'Ir al panel')}`,
        'Tu cuenta ya tiene acceso al panel.',
        STAFF_HEADER_LINE,
      ),
    })
  },
})

const vNoticeDecision = v.union(v.literal('rejected'), v.literal('selected'), v.literal('not_selected'))
type NoticeDecisionArg = 'rejected' | 'selected' | 'not_selected'

/**
 * The three decisions a family hears about. Fixed copy, drafted for XUNTAS
 * to approve: no internal note ever reaches a body, and no name beyond the
 * athlete's own. `cycleTitle` is the long, body-copy form (`titleOf`) — the
 * caller derives it from the same `cycle` string it also uses for the
 * header chrome, so a 2027 email says 2027 in both places.
 */
function decisionBody(decision: NoticeDecisionArg, firstName: string, cycleTitle: string) {
  const name = textForEmail(firstName, 60)
  const title = textForEmail(cycleTitle)
  switch (decision) {
    case 'rejected':
      return {
        subject: `Sobre tu registro · ${cycleTitle}`,
        preheader: 'Revisamos tu registro a la Convocatoria.',
        html: `<p style="margin:0 0 14px;">Hola, ${name}:</p>
          <p style="margin:0 0 14px;">Revisamos tu registro a la ${title} del Programa de Desarrollo y, en esta ocasión, no cumple con los requisitos de la convocatoria.</p>
          <p style="margin:0 0 14px;">Sabemos que detrás de un registro hay trabajo y ganas. Te animamos a seguir compitiendo y a registrarte en la siguiente convocatoria.</p>
          <p style="margin:0 0 14px;">Si tienes dudas, responde a este correo.</p>`,
      }
    case 'selected':
      return {
        subject: 'Fuiste seleccionad@ · Programa de Desarrollo XUNTAS+XUNTOS',
        preheader: 'El Consejo Técnico te seleccionó.',
        html: `<p style="margin:0 0 14px;">Hola, ${name}:</p>
          <p style="margin:0 0 14px;"><b>El Consejo Técnico te seleccionó para el Programa de Desarrollo</b> en la ${title}.</p>
          <p style="margin:0 0 14px;">En los próximos días te escribiremos con los siguientes pasos y la documentación que necesitamos para completar tu expediente.</p>
          <p style="margin:0 0 14px;">Felicidades. Nos da mucho gusto que formes parte.</p>
          ${button(`${appUrl()}/es/mi-registro`, 'Ver mi registro')}`,
      }
    case 'not_selected':
      return {
        subject: `Sobre tu registro · ${cycleTitle}`,
        preheader: 'El Consejo Técnico terminó su revisión.',
        html: `<p style="margin:0 0 14px;">Hola, ${name}:</p>
          <p style="margin:0 0 14px;">El Consejo Técnico terminó la revisión de la ${title}. En esta ocasión no fuiste seleccionad@ para el Programa de Desarrollo.</p>
          <p style="margin:0 0 14px;">El registro fue numeroso y los lugares, pocos. Esto no dice nada de tu potencial: te animamos a seguir compitiendo y a registrarte en la siguiente convocatoria.</p>
          <p style="margin:0 0 14px;">Si tienes dudas, responde a este correo.</p>`,
      }
  }
}

/**
 * Fired by `notices.sendRejection` / `notices.sendBatch`. A no-op (not an
 * error) if the notice is not pending — the scheduler is fire-and-forget, so
 * this is the guard against a second press racing the first one's own
 * scheduled run.
 */
export const sendDecisionNotice = internalMutation({
  args: { registrationId: v.id('registrations'), sentBy: v.id('users') },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.registrationId)
    if (!r || !r.decisionNotice || r.decisionNotice.status !== 'not_sent') return
    const user = await ctx.db.get(r.userId)
    if (!user) return

    const firstName = r.personal.name.trim().split(/\s+/)[0] || user.name || 'hola'
    const body = decisionBody(r.decisionNotice.decision, firstName, titleOf(r.cycle, 'es'))
    // The ACCOUNT email, which Clerk verified — never the one typed into the form.
    const emailId = await resend.sendEmail(ctx, {
      from: FROM,
      to: user.email,
      replyTo: [REPLY_TO],
      subject: body.subject,
      html: template(body.html, body.preheader, headerLineFor(r.cycle)),
    })
    await ctx.db.patch(r._id, {
      decisionNotice: { ...r.decisionNotice, status: 'sent', emailId, sentAt: Date.now(), sentBy: args.sentBy },
    })
  },
})

/** The same copy, to any address, with no row to patch. What a staff member checks before a batch goes out. */
export const sendDecisionTest = internalMutation({
  args: { to: v.string(), decision: vNoticeDecision, cycle: v.string() },
  handler: async (ctx, args) => {
    const body = decisionBody(args.decision, 'Prueba', titleOf(args.cycle, 'es'))
    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject: `[PRUEBA] ${body.subject}`,
      html: template(body.html, body.preheader, headerLineFor(args.cycle)),
    })
  },
})
