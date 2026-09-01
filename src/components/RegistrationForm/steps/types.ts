import type { RegistrationFormApi } from '../useRegistrationForm'

/**
 * Every step takes the one form and nothing else. A step that needed more
 * than this would be a step that knows where it sits in the sequence, which
 * is the orchestrator's business rather than its own.
 */
export type StepProps = {
  form: RegistrationFormApi
}
