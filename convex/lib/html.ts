/**
 * Escape de HTML para las plantillas de correo.
 *
 * Todo lo que se interpola en un correo viene de un formulario: el nombre del
 * atleta, el nombre del tutor. Sin escapar, quien se registra controla el
 * marcado de un mensaje que sale del dominio verificado de XUNTAS hacia una
 * dirección que también eligió. Eso es phishing con nuestro remitente.
 *
 * No usamos una librería: son cinco reemplazos y no queremos otra dependencia
 * en el camino del correo.
 */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Recorta y escapa. El límite evita que un nombre de 3 000 caracteres
 * deforme la plantilla o infle el correo.
 */
export function textoParaCorreo(valor: string, limite = 120): string {
  const limpio = valor.trim().replace(/\s+/g, ' ').slice(0, limite)
  return escaparHtml(limpio)
}

/** Correo con forma razonable. El mismo criterio que el resto de la app. */
export const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function correoValido(valor: string): boolean {
  return RE_CORREO.test(valor) && valor.length <= 254
}
