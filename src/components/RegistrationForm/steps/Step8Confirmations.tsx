import * as m from '../../../paraglide/messages.js'
import CheckboxField from '../CheckboxField'
import { DOCUMENTS } from '../../../lib/documents'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

export const fields = [
  'confirmations.rules',
  'confirmations.scholarshipUnderstood',
  'confirmations.privacy',
] as const satisfies readonly StepFieldPath[]

export default function Step8Confirmations({ form }: StepProps) {
  return (
    <>
      <form.Field
        name="confirmations.rules"
        validators={{ onDynamic: ({ value }) => (value ? undefined : ('confirm_rules_required' as const)) }}
      >
        {(field) => (
          <CheckboxField
            id="ck1"
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
          onDynamic: ({ value }) => (value ? undefined : ('confirm_scholarship_required' as const)),
        }}
      >
        {(field) => (
          <CheckboxField
            id="ck2"
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
        validators={{ onDynamic: ({ value }) => (value ? undefined : ('confirm_privacy_required' as const)) }}
      >
        {(field) => (
          <CheckboxField
            id="ck3"
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
    </>
  )
}
