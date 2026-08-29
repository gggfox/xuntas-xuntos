import * as m from '../../../paraglide/messages.js'
import DynamicRows from '../DynamicRows'
import { errorMessage } from '../../../lib/registrationErrors'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

export const fields = ['results'] as const satisfies readonly StepFieldPath[]

export default function Step4Results({ form }: StepProps) {
  return (
    <form.Field
      name="results"
      mode="array"
      validators={{
        onDynamic: ({ value }) =>
          value.some((r) => r.tournament.trim() && r.result.trim())
            ? undefined
            : ('results_required' as const),
      }}
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
          {field.state.meta.errors[0] && (
            <p className="mt-1.5 text-[11.5px] text-bad">
              {errorMessage(field.state.meta.errors[0])}
            </p>
          )}
        </>
      )}
    </form.Field>
  )
}
