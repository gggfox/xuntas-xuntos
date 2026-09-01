import RankingRows from '../RankingRows'
import { errorMessage } from '../../../lib/registrationErrors'
import { checkRankings } from '../../../lib/registrationRules'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

/**
 * Rankings, of which at least one is required.
 *
 * The step used to be empty and its field list with it: rankings were
 * optional, so the gate on "next" had nothing to hold anyone up over. Naming
 * `rankings` here is what puts it back under the gate — the list is how the
 * wizard knows which errors belong to this step, and a rule nobody is asked
 * about until the last page is a rule that reads as a trap.
 */
export const fields = ['rankings'] as const satisfies readonly StepFieldPath[]

export default function Step5Rankings({ form }: StepProps) {
  return (
    <form.Field
      name="rankings"
      mode="array"
      validators={{ onDynamic: ({ value }) => checkRankings(value) }}
    >
      {(field) => (
        <>
          <RankingRows
            rankings={field.state.value}
            onChange={(i, value) => {
              if (i < field.state.value.length) field.replaceValue(i, value)
              else field.pushValue(value)
            }}
            onBlur={field.handleBlur}
          />
          {/* Reserved even when empty, for the same reason as step 4: the
              nav under it must not move when the message appears. */}
          <p className="mt-1.5 min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">
            {field.state.meta.errors[0] ? errorMessage(field.state.meta.errors[0]) : null}
          </p>
        </>
      )}
    </form.Field>
  )
}
