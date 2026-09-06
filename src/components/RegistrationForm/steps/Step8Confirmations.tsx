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
 * So these three say nothing until the reader either presses a card or tries
 * to send: `onSubmit` is what marks them when the send is refused, `onChange`
 * is what unmarks them the moment a card is pressed, without waiting for a
 * second attempt.
 */
export default function Step8Confirmations({ form }: StepProps) {
  return (
    /* `auto-rows-fr` is what keeps the three cards the same height stacked on
       a phone: without it each row sizes to its own text and the middle card,
       which carries no document link, sits visibly shorter than the two
       around it. */
    <div className="grid auto-rows-fr grid-cols-1 gap-3 lg:grid-cols-3">
      <form.Field
        name="confirmations.rules"
        validators={{
          onChange: ({ value }) => (value ? undefined : ('confirm_rules_required' as const)),
          onSubmit: ({ value }) => (value ? undefined : ('confirm_rules_required' as const)),
        }}
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
        validators={{
          onChange: ({ value }) => (value ? undefined : ('confirm_scholarship_required' as const)),
          onSubmit: ({ value }) => (value ? undefined : ('confirm_scholarship_required' as const)),
        }}
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
        validators={{
          onChange: ({ value }) => (value ? undefined : ('confirm_privacy_required' as const)),
          onSubmit: ({ value }) => (value ? undefined : ('confirm_privacy_required' as const)),
        }}
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
