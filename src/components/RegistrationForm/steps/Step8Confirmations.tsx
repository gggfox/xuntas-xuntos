import type { AnyFieldApi } from '@tanstack/react-form'
import * as m from '../../../paraglide/messages.js'
import Icons from '../../Icons'
import CheckboxField from '../CheckboxField'
import { DOCUMENTS } from '../../../lib/documents'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

export const fields = [
  'confirmations.rules',
  'confirmations.scholarshipUnderstood',
  'confirmations.privacy',
] as const satisfies readonly StepFieldPath[]

/**
 * Change and submit, not the form's usual blur.
 *
 * Everywhere else a field is checked when the reader leaves it, which is the
 * right moment for something you type: leaving it is how you say you finished
 * writing. A confirmation has nothing in progress to finish — it is off until
 * it is pressed, and off is where it starts — so blur carries no news about
 * it, and checking on blur meant the reader who simply tabbed from the
 * heading down to the send button arrived with all three cards red for the
 * crime of having been passed through.
 *
 * So these three say nothing until the reader tries to send: `onSubmit` is
 * what marks them when the send is refused, and `onChange` is what unmarks
 * them the moment a card is pressed, without waiting for a second attempt.
 *
 * Before that first send, `onChange` only ever clears. A card pressed on and
 * then off again is a reader who changed their mind, and until something has
 * asked for the card to be true that is not a mistake — yet the change rule
 * used to answer the un-press with "you must accept", the one message the
 * step was built not to show before it was earned. After a refused send the
 * form is in change mode and the message is back on the un-press, as it
 * should be: the reader has been told what is missing, and it is missing
 * again.
 */
function confirmation(code: ConfirmationCode) {
  return {
    onChange: ({ value, fieldApi }: { value: boolean; fieldApi: AnyFieldApi }) =>
      value || fieldApi.form.state.submissionAttempts === 0 ? undefined : code,
    onSubmit: ({ value }: { value: boolean }) => (value ? undefined : code),
  }
}

type ConfirmationCode =
  | 'confirm_rules_required'
  | 'confirm_scholarship_required'
  | 'confirm_privacy_required'

export default function Step8Confirmations({ form }: StepProps) {
  return (
    /* `auto-rows-fr` is what keeps the three cards the same height stacked on
       a phone: without it each row sizes to its own text and the middle card,
       which carries no document link, sits visibly shorter than the two
       around it. */
    <div className="grid auto-rows-fr grid-cols-1 gap-3 lg:grid-cols-3">
      <form.Field
        name="confirmations.rules"
        validators={confirmation('confirm_rules_required')}
      >
        {(field) => (
          <CheckboxField
            id="ck1"
            icon={<Icons.Document />}
            title={m.reg_ck_rules()}
            sub={m.reg_ck_rules_sub()}
            checked={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
            doc={{ ...DOCUMENTS.rules, label: m.rules_title() }}
          />
        )}
      </form.Field>

      <form.Field
        name="confirmations.scholarshipUnderstood"
        validators={confirmation('confirm_scholarship_required')}
      >
        {(field) => (
          <CheckboxField
            id="ck2"
            icon={<Icons.Award />}
            title={m.reg_ck_scholarship()}
            sub={m.reg_ck_scholarship_sub()}
            checked={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
          />
        )}
      </form.Field>

      <form.Field
        name="confirmations.privacy"
        validators={confirmation('confirm_privacy_required')}
      >
        {(field) => (
          <CheckboxField
            id="ck3"
            icon={<Icons.Shield />}
            title={m.reg_ck_privacy()}
            sub={m.reg_ck_privacy_sub()}
            checked={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
            doc={{ ...DOCUMENTS.privacyNotice, label: m.privacy_title() }}
          />
        )}
      </form.Field>
    </div>
  )
}
