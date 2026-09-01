import * as m from '../../../paraglide/messages.js'
import LetterField from '../LetterField'
import { checkLetter } from '../../../lib/registrationRules'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

export const fields = ['motivationLetter'] as const satisfies readonly StepFieldPath[]

export default function Step7Letter({ form }: StepProps) {
  return (
    <form.Field name="motivationLetter" validators={{ onDynamic: ({ value }) => checkLetter(value) }}>
      {(field) => (
        <LetterField
          id="letter"
          label={m.reg_s7_title()}
          value={field.state.value}
          onChange={field.handleChange}
          onBlur={field.handleBlur}
          error={field.state.meta.errors[0]}
        />
      )}
    </form.Field>
  )
}
