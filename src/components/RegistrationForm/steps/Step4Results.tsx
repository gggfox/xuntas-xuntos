import * as m from '../../../paraglide/messages.js'
import DynamicRows from '../DynamicRows'
import { errorMessage } from '../../../lib/registrationErrors'
import { checkResults } from '../../../lib/registrationRules'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

export const fields = ['results'] as const satisfies readonly StepFieldPath[]

export default function Step4Results({ form }: StepProps) {
  return (
    <form.Field
      name="results"
      mode="array"
      validators={{ onDynamic: ({ value }) => checkResults(value) }}
    >
      {(field) => (
        <>
          <DynamicRows
            rows={field.state.value.map((r) => ({ a: r.tournament, b: r.result }))}
            phA={m.reg_tournament_name()}
            phB={m.reg_tournament_result()}
            addLabel={m.reg_add_tournament()}
            onEdit={(i, key, v) => {
              const row = field.state.value[i]
              field.replaceValue(i, key === 'a' ? { ...row, tournament: v } : { ...row, result: v })
            }}
            onRemove={(i) => field.removeValue(i)}
            onAdd={() => field.pushValue({ tournament: '', result: '' })}
            onBlur={field.handleBlur}
          />
          {/* Reserved whether or not there is anything to say, so the
              buttons under it stay where the reader left them. */}
          <p className="mt-1.5 min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">
            {field.state.meta.errors[0] ? errorMessage(field.state.meta.errors[0]) : null}
          </p>
        </>
      )}
    </form.Field>
  )
}
