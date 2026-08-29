import * as m from '../../../paraglide/messages.js'
import FieldGrid from '../FieldGrid'
import SelectField from '../SelectField'
import TextField from '../TextField'
import { checkRequiredText } from '../../../lib/registrationRules'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

/** `athletic.amateurStatus` is a boolean with a default and no rule to fail. */
export const fields = [
  'athletic.club',
  'athletic.coach',
  'athletic.ghin',
] as const satisfies readonly StepFieldPath[]

export default function Step3Athletic({ form }: StepProps) {
  return (
    <FieldGrid>
      <form.Field
        name="athletic.club"
        validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'club_required') }}
      >
        {(field) => (
          <TextField
            id="club"
            label={m.reg_club()}
            req
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
          />
        )}
      </form.Field>

      <form.Field
        name="athletic.coach"
        validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'coach_required') }}
      >
        {(field) => (
          <TextField
            id="coach"
            label={m.reg_coach()}
            req
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
          />
        )}
      </form.Field>

      <form.Field name="athletic.amateurStatus">
        {(field) => (
          <SelectField
            id="status"
            label={m.reg_status()}
            req
            help={m.reg_status_help()}
            value={field.state.value ? 'amateur' : ''}
            onChange={(v) => field.handleChange(v === 'amateur')}
            onBlur={field.handleBlur}
            options={[
              { v: '', t: m.reg_branch_select() },
              { v: 'amateur', t: m.reg_status_amateur() },
              { v: 'pro', t: m.reg_status_pro() },
            ]}
          />
        )}
      </form.Field>

      <form.Field
        name="athletic.ghin"
        validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'ghin_required') }}
      >
        {(field) => (
          <TextField
            id="ghin"
            label={m.reg_ghin()}
            req
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
          />
        )}
      </form.Field>
    </FieldGrid>
  )
}
