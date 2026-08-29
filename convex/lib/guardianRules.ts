import type { FieldErrorCode } from './errorCodes'
import { isUnderage } from './cycle'
import { isValidEmail } from './html'
import { checkBirthDate } from './registrationRules'

/**
 * Rules for declaring a birth date and, if that makes you a minor, your
 * guardian's details.
 *
 * Used by three callers that had three different answers: the age gate
 * (`/empezar`) hand-rolled its own date check, the recovery screen in
 * `/mi-registro` had none at all, and the server had a third. They now share
 * this.
 */

export const GUARDIAN_NAME_LIMIT = 120

export type GuardianFieldPath = 'birthDate' | 'guardianName' | 'guardianEmail'

export type GuardianError = {
  field: GuardianFieldPath
  code: FieldErrorCode
}

export type BirthDateDeclaration = {
  birthDate: string
  guardianName?: string
  guardianEmail?: string
  /**
   * The registrant's own address, when it is known. Supplying it turns on the
   * check that a guardian's email is not the registrant's own — the point of
   * asking a guardian at all.
   */
  ownEmail?: string
}

export function checkGuardianName(value: string | undefined): FieldErrorCode | undefined {
  const v = (value ?? '').trim()
  if (!v) return 'guardian_name_required'
  if (v.length > GUARDIAN_NAME_LIMIT) return 'guardian_name_too_long'
  return undefined
}

export function checkGuardianEmail(
  value: string | undefined,
  ownEmail?: string,
): FieldErrorCode | undefined {
  const v = (value ?? '').trim().toLowerCase()
  if (!isValidEmail(v)) return 'guardian_email_invalid'
  const own = (ownEmail ?? '').trim().toLowerCase()
  if (own && v === own) return 'guardian_email_same_as_own'
  return undefined
}

export function validateBirthDateDeclaration(
  input: BirthDateDeclaration,
  now: number = Date.now(),
): GuardianError[] {
  const errors: GuardianError[] = []

  const dateCode = checkBirthDate(input.birthDate, now)
  if (dateCode) {
    // No point asking about a guardian when we cannot tell whether one is
    // needed.
    return [{ field: 'birthDate', code: dateCode }]
  }

  if (!isUnderage(input.birthDate, now)) return errors

  const nameCode = checkGuardianName(input.guardianName)
  if (nameCode) errors.push({ field: 'guardianName', code: nameCode })

  const emailCode = checkGuardianEmail(input.guardianEmail, input.ownEmail)
  if (emailCode) errors.push({ field: 'guardianEmail', code: emailCode })

  return errors
}
