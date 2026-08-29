import { revalidateLogic, useForm } from '@tanstack/react-form'
import { validateRegistration } from '../../lib/registrationRules'
import type { RegistrationData } from '../../lib/registrationSchema'

/**
 * The one form store, lifted out so the steps can be typed against it without
 * importing the orchestrator that owns it.
 *
 * There is deliberately a single store for all eight steps rather than one
 * per step: the autosave fingerprints the whole registration, the rules
 * validate the whole registration, and the submit sends the whole
 * registration. Slicing the store by step would buy nothing and cost a merge
 * layer between three things that all want the same object.
 *
 * Validation runs on blur before the first submit and on change after it, so
 * nobody is told they are wrong halfway through typing their own name, and a
 * field they have already fixed clears itself without waiting for another
 * submit.
 *
 * The form-level validator is not a duplicate of the field ones. TanStack
 * validates the fields that are *registered*, and in a form shown one step at
 * a time seven eighths of them are unmounted at any moment — so a submit from
 * the last step checked the last step and nothing else, and an unfinished
 * registration went off to the server to be refused there. This asks the
 * shared rules about the whole value, which is what the server asks too, and
 * it does not care what happens to be on screen.
 */
export function useRegistrationForm({
  initial,
  onValid,
  onInvalid,
}: {
  initial: RegistrationData
  onValid: (value: RegistrationData) => Promise<void>
  onInvalid: (value: RegistrationData) => void
}) {
  return useForm({
    defaultValues: initial,
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onSubmit: ({ value }) =>
        validateRegistration(value).length > 0 ? 'registration_incomplete' : undefined,
    },
    onSubmit: async ({ value }) => {
      await onValid(value)
    },
    onSubmitInvalid: ({ value }) => {
      onInvalid(value)
    },
  })
}

export type RegistrationFormApi = ReturnType<typeof useRegistrationForm>
