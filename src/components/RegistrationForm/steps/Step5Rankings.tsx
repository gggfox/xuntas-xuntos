import RankingRows from '../RankingRows'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

/**
 * Empty on purpose. Rankings are optional — "deja en blanco los que no" —
 * so there is nothing here for the gate on "next" to hold anyone up over.
 */
export const fields = [] as const satisfies readonly StepFieldPath[]

export default function Step5Rankings({ form }: StepProps) {
  return (
    <form.Field name="rankings" mode="array">
      {(field) => (
        <RankingRows
          rankings={field.state.value}
          onChange={(i, value) => {
            if (i < field.state.value.length) field.replaceValue(i, value)
            else field.pushValue(value)
          }}
          onBlur={field.handleBlur}
        />
      )}
    </form.Field>
  )
}
