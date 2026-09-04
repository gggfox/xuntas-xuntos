import { useMemo } from 'react'
import * as m from '../../paraglide/messages.js'
import { compare, parseISO, todayMX, toISO, type Ymd } from './date'
import { useDateFormats } from './format'
import Calendar from './Calendar'

type Props = {
  id: string
  label: string
  /** ISO days or empty. */
  start: string
  end: string
  onChange: (next: { start: string; end: string }) => void
  /** ISO bounds. Defaults: today to five years ahead. */
  min?: string
  max?: string
  error?: string
}

/**
 * Two days on one grid. First click is the start, second the end, third
 * starts over; a second click before the first swaps them, so "closes before
 * opens" cannot be entered rather than merely being invalid. The typed boxes
 * beside it are for the person who already knows the dates.
 */
export default function RangeField({ id, label, start, end, onChange, min, max, error }: Props) {
  const fmt = useDateFormats()
  const today = useMemo(() => todayMX(), [])
  const lo = useMemo(() => parseISO(min ?? '') ?? today, [min, today])
  const hi = useMemo(() => parseISO(max ?? '') ?? { ...today, y: today.y + 5 }, [max, today])
  const startDay = useMemo(() => parseISO(start), [start])
  const endDay = useMemo(() => parseISO(end), [end])

  function pick(day: Ymd) {
    if (!startDay || endDay) {
      onChange({ start: toISO(day), end: '' })
      return
    }
    if (compare(day, startDay) < 0) {
      onChange({ start: toISO(day), end: toISO(startDay) })
      return
    }
    onChange({ start: toISO(startDay), end: toISO(day) })
  }

  const errorId = `${id}-err`

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12.5px] font-medium">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12.5px]">
          <span className="eyebrow block">{m.range_start()}</span>
          <input
            id={`${id}-start`}
            className="fld-input mt-1 font-mono tracking-[0.04em] tabular-nums"
            value={start}
            placeholder="aaaa-mm-dd"
            onChange={(e) => onChange({ start: e.target.value, end })}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        <label className="text-[12.5px]">
          <span className="eyebrow block">{m.range_end()}</span>
          <input
            id={`${id}-end`}
            className="fld-input mt-1 font-mono tracking-[0.04em] tabular-nums"
            value={end}
            placeholder="aaaa-mm-dd"
            onChange={(e) => onChange({ start, end: e.target.value })}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
      </div>
      <Calendar
        id={`${id}-cal`}
        label={label}
        selected={startDay}
        rangeEnd={endDay}
        today={today}
        min={lo}
        max={hi}
        openAt={startDay ?? today}
        fmt={fmt}
        onPick={pick}
      />
      <p id={errorId} className={`min-h-[1.45em] text-[11.5px] leading-[1.45] ${error ? 'text-bad' : 'text-soft'}`}>
        {error ?? m.range_hint()}
      </p>
    </div>
  )
}
