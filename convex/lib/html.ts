/**
 * HTML escaping for the email templates.
 *
 * Everything interpolated into an email comes from a form: the athlete's name,
 * the guardian's name. Without escaping, whoever registers controls the markup
 * of a message that leaves XUNTAS's verified domain toward an address they
 * also chose. That is phishing with our sender.
 *
 * We do not use a library: it is five replacements and we do not want another
 * dependency on the email path.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Trims and escapes. The limit keeps a 3,000-character name from deforming
 * the template or bloating the email.
 */
export function textForEmail(value: string, limit = 120): string {
  const clean = value.trim().replace(/\s+/g, ' ').slice(0, limit)
  return escapeHtml(clean)
}

/** A reasonably shaped email. The same criterion as the rest of the app. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 254
}
