import { validateRegistration } from './registrationRules'
import type { RegistrationData } from './registrationSchema'
import type { RegistrationError, RegistrationFieldPath } from './registrationRules'

/**
 * Which fields belong to which step, and what follows from that.
 *
 * The membership list itself lives with the steps that render it — see
 * `components/RegistrationForm/steps` — and arrives here as an argument.
 * Nothing in this file knows React, which is the point: where the reader is
 * in the form is arithmetic over the same rules the server runs, and it is
 * cheaper to be sure of it here than through a rendered form.
 *
 * Indices are 0-based throughout. Step 1 in the copy is index 0 here; the
 * numbering the reader sees belongs to the section headings, not to this.
 */
export type StepFields = readonly (readonly StepFieldPath[])[]

/**
 * Every path a step can render. `form` is excluded by construction: it is
 * where a rejection of the whole submission lands, not an input, and letting
 * it into a step's list would let it reach `form.validateField`, which has no
 * such field to validate.
 */
export type StepFieldPath = Exclude<RegistrationFieldPath, 'form'>

/**
 * `form` is the odd one out: it is where a rejection of the whole submission
 * lands — the window closed, the registration was already reviewed — and it
 * belongs to no step. Such an error has to stay visible in the summary while
 * never being the reason we send anyone anywhere.
 */
export function stepOfField(
  steps: StepFields,
  field: RegistrationFieldPath,
): number | null {
  const i = steps.findIndex((fields) => fields.some((f) => f === field))
  return i === -1 ? null : i
}

/** Only the errors belonging to one step. What the gate on "next" asks about. */
export function stepErrors(
  steps: StepFields,
  step: number,
  errors: readonly RegistrationError[],
): RegistrationError[] {
  const fields = steps[step]
  if (!fields) return []
  return errors.filter((e) => fields.some((f) => f === e.field))
}

/**
 * The earliest step holding a problem, by position rather than by the order
 * the errors arrived in. The rules happen to report in document order today,
 * and this does not depend on their continuing to.
 */
export function firstStepWithError(
  steps: StepFields,
  errors: readonly RegistrationError[],
): number | null {
  let earliest: number | null = null
  for (const e of errors) {
    const step = stepOfField(steps, e.field)
    if (step !== null && (earliest === null || step < earliest)) earliest = step
  }
  return earliest
}

/**
 * Where to open the form: the first step still missing something.
 *
 * A finished draft opens on the last step, which is where the submit button
 * is — the reader came back to send it, not to read it again.
 */
export function firstIncompleteStep(steps: StepFields, data: RegistrationData): number {
  const last = Math.max(0, steps.length - 1)
  return firstStepWithError(steps, validateRegistration(data)) ?? last
}

/**
 * What a requested step is allowed to be on arrival.
 *
 * A step number out of the URL is a request from outside, and the gate on
 * "next" would mean nothing if `?paso=8` walked around it. Clamped to the
 * first incomplete step, which is as far as anyone could have got by filling
 * the form in. Deliberately not applied while the form is open: someone who
 * reaches step 5 and then empties a field on step 2 has not been sent back
 * to step 2, and yanking them there mid-sentence would be its own bug.
 */
export function clampStep(
  requested: number,
  steps: StepFields,
  data: RegistrationData,
): number {
  const last = Math.max(0, steps.length - 1)
  const bounded = Math.min(Math.max(0, Math.trunc(requested)), last)
  return Math.min(bounded, firstIncompleteStep(steps, data))
}
