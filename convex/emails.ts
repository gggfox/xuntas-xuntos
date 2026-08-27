import { Resend, vOnEmailEventArgs } from '@convex-dev/resend'
import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { FECHA_REVISION } from './lib/ciclo'

/**
 * Cliente de Resend con ejecución durable: cola, reintentos e idempotencia.
 * Importa para el correo del tutor — si Resend está caído, el correo se envía
 * cuando vuelva, no se pierde.
 *
 * testMode:false envía a direcciones reales. Mientras sea true, Resend solo
 * acepta @resend.dev.
 */
export const resend: Resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== 'false',
  onEmailEvent: internal.emails.registrarEventoCorreo,
})

const DE = 'XUNTAS+XUNTOS <registro@xuntas.org>'
const RESPONDER_A = 'hola@xuntas.org'

const appUrl = () => process.env.APP_URL ?? 'https://app.xuntas.org'

/** Envoltura HTML compartida. Correo = tablas y estilos en línea, no Tailwind. */
function plantilla(contenido: string, preheader: string): string {
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
    ${contenido}
  </td></tr>
  <tr><td style="padding:18px 26px;border-top:1px solid rgba(17,17,17,.11);font-family:'Courier New',monospace;font-size:11px;color:rgba(17,17,17,.58);">
    Este correo se envió porque alguien inició un registro en ${appUrl()}.<br>
    ¿Dudas? Responde a este mensaje.
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function boton(href: string, texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;"><tr>
    <td style="background:#EDF45F;border:1px solid #111111;border-radius:7px;">
      <a href="${href}" style="display:inline-block;padding:12px 22px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;text-decoration:none;">${texto}</a>
    </td></tr></table>`
}

/**
 * Confirmación al atleta. Se dispara al enviar el registro, no al crear la
 * cuenta — la cuenta por sí sola no es un registro.
 */
export const enviarConfirmacionAtleta = internalMutation({
  args: {
    para: v.string(),
    nombre: v.string(),
    faltaTutor: v.boolean(),
  },
  handler: async (ctx, args) => {
    const primerNombre = args.nombre.trim().split(/\s+/)[0] || args.nombre

    const avisoTutor = args.faltaTutor
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
      from: DE,
      to: args.para,
      replyTo: [RESPONDER_A],
      subject: 'Recibimos tu registro · Convocatoria 2026–2027',
      html: plantilla(
        `<p style="margin:0 0 14px;">Hola, ${primerNombre}:</p>
         <p style="margin:0 0 14px;">Tu registro al Programa de Desarrollo quedó guardado.</p>
         ${avisoTutor}
         <p style="margin:0 0 14px;"><b>Qué sigue.</b> Revisamos tu registro antes del ${FECHA_REVISION}.
         Puedes editar tus datos hasta el 18 de septiembre a las 23:59, hora del centro de México.</p>
         <p style="margin:0 0 14px;">Recuerda que el registro no garantiza la admisión ni la obtención de una beca.</p>
         ${boton(`${appUrl()}/es/mi-registro`, 'Ver mi registro')}`,
        'Tu registro al Programa de Desarrollo quedó guardado.',
      ),
    })
  },
})

/**
 * Autorización del tutor. Es el consentimiento real para tratar los datos de
 * una persona menor de edad — la casilla que palomea el atleta no lo es.
 */
export const enviarAutorizacionTutor = internalMutation({
  args: {
    para: v.string(),
    tutorNombre: v.string(),
    atletaNombre: v.string(),
    token: v.string(),
    esReenvio: v.boolean(),
  },
  handler: async (ctx, args) => {
    const href = `${appUrl()}/es/autorizar/${args.token}`
    const asunto = args.esReenvio
      ? `Recordatorio: autoriza la cuenta de ${args.atletaNombre}`
      : `Autoriza la cuenta de ${args.atletaNombre} · XUNTAS+XUNTOS`

    await resend.sendEmail(ctx, {
      from: DE,
      to: args.para,
      replyTo: [RESPONDER_A],
      subject: asunto,
      html: plantilla(
        `<p style="margin:0 0 14px;">Hola, ${args.tutorNombre}:</p>
         <p style="margin:0 0 14px;">
           <b>${args.atletaNombre}</b> se registró a la Convocatoria General 2026–2027 del
           Programa de Desarrollo de XUNTAS+XUNTOS y te señaló como su padre, madre o tutor.
         </p>
         <p style="margin:0 0 14px;">
           Como es menor de edad, necesitamos tu autorización para crear su cuenta y tratar sus datos.
           No hay ningún documento que cargar: basta con que confirmes aquí.
         </p>
         ${boton(href, 'Autorizo la cuenta')}
         <p style="margin:0 0 14px;font-size:13px;color:rgba(17,17,17,.58);">
           El enlace vence el 18 de septiembre de 2026. Si no reconoces este registro,
           ignora este correo y responde para avisarnos: la cuenta no quedará autorizada.
         </p>`,
        `${args.atletaNombre} necesita tu autorización para completar su registro.`,
      ),
    })
  },
})

/** Estados de entrega que reporta Resend por webhook. Solo se registran. */
export const registrarEventoCorreo = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (_ctx, args) => {
    if (args.event.type === 'email.bounced' || args.event.type === 'email.complained') {
      console.error(`Correo ${args.event.type}: ${args.id}`)
    }
  },
})
