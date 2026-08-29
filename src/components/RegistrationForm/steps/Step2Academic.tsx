import * as m from '../../../paraglide/messages.js'
import FieldGrid from '../FieldGrid'
import TextField from '../TextField'
import { checkGraduationYear, checkRequiredText } from '../../../lib/registrationRules'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

/** `academic.interest` is optional and has no rule, so it is not gated on. */
export const fields = [
  'academic.school',
  'academic.grade',
  'academic.graduationYear',
] as const satisfies readonly StepFieldPath[]

export default function Step2Academic({ form }: StepProps) {
  return (
    <FieldGrid>
      <form.Field
        name="academic.school"
        validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'school_required') }}
      >
        {(field) => (
          <TextField
            id="school"
            label={m.reg_school()}
            req
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
          />
        )}
      </form.Field>

      <form.Field
        name="academic.grade"
        validators={{ onDynamic: ({ value }) => checkRequiredText(value, 'grade_required') }}
      >
        {(field) => (
          <TextField
            id="grade"
            label={m.reg_grade()}
            req
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
          />
        )}
      </form.Field>

      <form.Field
        name="academic.graduationYear"
        validators={{ onDynamic: ({ value }) => checkGraduationYear(value) }}
      >
        {(field) => (
          <TextField
            id="grad"
            label={m.reg_graduation()}
            help={m.reg_graduation_help()}
            value={field.state.value ?? ''}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]}
          />
        )}
      </form.Field>

      <form.Field name="academic.interest">
        {(field) => (
          <TextField
            id="interest"
            label={m.reg_interest()}
            value={field.state.value ?? ''}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>
    </FieldGrid>
  )
}
