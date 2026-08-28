/**
 * Bridge between the age gate and the Clerk sign-up.
 *
 * The birth date and the guardian's email used to live here. Not anymore: the
 * age gate is resolved by the server (`convex/preSignups.ts`) and the only
 * thing the browser stores is the token it returns, which is an opaque
 * reference.
 *
 * It stays in sessionStorage and not in the URL so that not even the token
 * ends up in the browser history or in anyone's logs.
 */

const KEY = 'xx.preSignupToken'

export function savePreSignupToken(token: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(KEY, token)
}

export function readPreSignupToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(KEY) || null
}

export function clearPreSignup(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(KEY)
}

/**
 * Age in completed years, in central Mexico time.
 *
 * It is only for the UI: deciding whether to show the guardian fields while
 * the date is being typed. The one that truly decides is the server, which
 * recomputes this very thing in `preSignups.create`. It is re-exported from
 * the backend so they cannot disagree.
 */
export { ageAt, isUnderage, isValidBirthDate } from '../../convex/lib/cycle'
