import { Resend, vOnEmailEventArgs } from '@convex-dev/resend'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { REVIEW_DATE } from './lib/cycle'
import { textForEmail } from './lib/html'

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

/** Shared HTML wrapper. Email = tables and inline styles, not Tailwind. */
function template(content: string, preheader: string): string {
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
        <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);">Convocatoria 2026&ndash;2027</div>
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
  },
  handler: async (ctx, args) => {
    // Escaped: the name comes from the form and ends up inside the HTML.
    const firstName = textForEmail(args.name.trim().split(/\s+/)[0] || args.name, 60)

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
      subject: 'Recibimos tu registro · Convocatoria 2026–2027',
      html: template(
        `<p style="margin:0 0 14px;">Hola, ${firstName}:</p>
         <p style="margin:0 0 14px;">Tu registro al Programa de Desarrollo quedó guardado.</p>
         ${guardianNotice}
         <p style="margin:0 0 14px;"><b>Qué sigue.</b> Revisamos tu registro antes del ${REVIEW_DATE}.
         Puedes editar tus datos hasta el 18 de septiembre a las 23:59, hora del centro de México.</p>
         <p style="margin:0 0 14px;">Recuerda que el registro no garantiza la admisión ni la obtención de una beca.</p>
         ${button(`${appUrl()}/es/mi-registro`, 'Ver mi registro')}`,
        'Tu registro al Programa de Desarrollo quedó guardado.',
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

    await resend.sendEmail(ctx, {
      from: FROM,
      to: args.to,
      replyTo: [REPLY_TO],
      subject,
      html: template(
        `<p style="margin:0 0 14px;">Hola, ${guardianName}:</p>
         <p style="margin:0 0 14px;">
           <b>${athleteName}</b> se registró a la Convocatoria General 2026–2027 del
           Programa de Desarrollo de XUNTAS+XUNTOS y te señaló como su padre, madre o tutor.
         </p>
         <p style="margin:0 0 14px;">
           Como es menor de edad, necesitamos tu autorización para crear su cuenta y tratar sus datos.
           No hay ningún documento que cargar: basta con que confirmes aquí.
         </p>
         ${button(href, 'Autorizo la cuenta')}
         <p style="margin:0 0 14px;font-size:13px;color:rgba(17,17,17,.58);">
           El enlace vence el 18 de septiembre de 2026. Si no reconoces este registro,
           ignora este correo y responde para avisarnos: la cuenta no quedará autorizada.
         </p>`,
        `${athleteName} necesita tu autorización para completar su registro.`,
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
 */
export const recordEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (_ctx, args) => {
    if (args.event.type === 'email.bounced' || args.event.type === 'email.complained') {
      console.error(
        `[email] FAILURE ${args.event.type} id=${args.id} — ` +
          'check who it was addressed to in the Resend dashboard',
      )
      return
    }
    if (args.event.type === 'email.delivery_delayed') {
      console.warn(`[email] delayed id=${args.id}`)
    }
  },
})
