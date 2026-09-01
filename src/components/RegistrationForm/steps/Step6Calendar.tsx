import { useMemo } from 'react'
import * as m from '../../../paraglide/messages.js'
import DynamicRows from '../DynamicRows'
import MonthField from '../../DateField/MonthField'
import { addMonths, todayMX, toMonthISO } from '../../DateField/date'
import type { StepFieldPath } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

/** Optional, like the rankings. Nothing to gate on. */
export const fields = [] as const satisfies readonly StepFieldPath[]

/**
 * How far ahead the picker will look.
 *
 * The step asks which tournaments are *planned*, so the range runs the other
 * way from the date of birth's: it starts at the month the reader is in and
 * stops two years out. A schedule further off than that is not a plan, and
 * offering the year 2043 is how a typo becomes a stored value nobody catches.
 * Anything already played belongs to step 4.
 */
const MONTHS_AHEAD = 24

export default function Step6Calendar({ form }: StepProps) {
  const range = useMemo(() => {
    const today = todayMX()
    return { min: toMonthISO(today), max: toMonthISO(addMonths(today, MONTHS_AHEAD)) }
  }, [])

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
          renderB={(i, value, label) => (
            <MonthField
              id={`cal-date-${i}`}
              label={label}
              hideLabel
              value={value}
              onChange={(iso) => {
                const row = field.state.value[i]
                field.replaceValue(i, { ...row, date: iso })
              }}
              onBlur={field.handleBlur}
              min={range.min}
              max={range.max}
            />
          )}
        />
      )}
    </form.Field>
  )
}
