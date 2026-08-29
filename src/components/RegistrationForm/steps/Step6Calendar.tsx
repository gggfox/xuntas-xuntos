import * as m from '../../../paraglide/messages.js'
import DynamicRows from '../DynamicRows'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

/** Optional, like the rankings. Nothing to gate on. */
export const fields = [] as const satisfies readonly StepFieldPath[]

export default function Step6Calendar({ form }: StepProps) {
  return (
    <form.Field name="calendar" mode="array">
      {(field) => (
        <DynamicRows
          rows={field.state.value.map((c) => ({ a: c.event, b: c.date }))}
          phA={m.reg_event_name()}
          phB={m.reg_event_date()}
          addLabel={m.reg_add_event()}
          onEdit={(i, key, v) => {
            const row = field.state.value[i]
            field.replaceValue(i, key === 'a' ? { ...row, event: v } : { ...row, date: v })
          }}
          onRemove={(i) => field.removeValue(i)}
          onAdd={() => field.pushValue({ event: '', date: '' })}
          onBlur={field.handleBlur}
        />
      )}
    </form.Field>
  )
}
