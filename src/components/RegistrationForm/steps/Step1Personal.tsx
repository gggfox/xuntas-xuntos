import * as m from '../../../paraglide/messages.js'
import DateField from '../../DateField'
import FieldGrid from '../FieldGrid'
import SelectField from '../SelectField'
import TextField from '../TextField'
import { errorMessage } from '../../../lib/registrationErrors'
import {
  checkBirthDate,
  checkBranch,
  checkEmail,
  checkName,
  checkRequiredText,
  checkWhatsapp,
} from '../../../lib/registrationRules'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

/**
 * Declared beside the fields it names. This is what the gate on "next" asks
 * about, and a step that validated a field it does not render — or rendered
 * one it does not validate — would either trap the reader on a step with no
 * visible problem or wave them past a real one.
 */
export const fields = [
  'personal.name',
  'personal.email',
  'personal.whatsapp',
  'personal.birthDate',
  'personal.branch',
  'personal.cityState',
] as const satisfies readonly StepFieldPath[]

export default function Step1Personal({ form }: StepProps) {
  return (
    <FieldGrid>
      <form.Field name="personal.name" validators={{ onDynamic: ({ value }) => checkName(value) }}>
        {(field) => (
          <TextField
            id="name"
            label={m.reg_name()}
            req
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
            autoComplete="name"
          />
        )}
      </form.Field>

      <form.Field name="personal.email" validators={{ onDynamic: ({ value }) => checkEmail(value) }}>
        {(field) => (
          <TextField
            id="mail"
            type="email"
            label={m.reg_email()}
            req
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
            autoComplete="email"
          />
        )}
      </form.Field>

      <form.Field name="personal.whatsapp" validators={{ onDynamic: ({ value }) => checkWhatsapp(value) }}>
        {(field) => (
          <TextField
            id="tel"
            type="tel"
            label={m.reg_whatsapp()}
            req
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
            autoComplete="tel"
          />
        )}
      </form.Field>

      <form.Field name="personal.birthDate" validators={{ onDynamic: ({ value }) => checkBirthDate(value) }}>
        {(field) => (
          <div className="mb-[15px]">
            <DateField
              id="birth"
              label={m.reg_birth_date()}
              req
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={field.state.meta.errors[0] ? errorMessage(field.state.meta.errors[0]) : undefined}
              autoComplete="bday"
            />
          </div>
        )}
      </form.Field>

      <form.Field name="personal.branch" validators={{ onDynamic: ({ value }) => checkBranch(value) }}>
        {(field) => (
          <SelectField
            id="branch"
            label={m.reg_branch()}
            req
            value={field.state.value}
            onChange={(v) => field.handleChange(v as 'womens' | 'mens')}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
            options={[
              { v: '', t: m.reg_branch_select() },
              { v: 'womens', t: m.reg_branch_womens() },
              { v: 'mens', t: m.reg_branch_mens() },
            ]}
          />
        )}
      </form.Field>

      <form.Field
        name="personal.cityState"
        validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'city_required') }}
      >
        {(field) => (
          <TextField
            id="city"
            label={m.reg_city()}
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
