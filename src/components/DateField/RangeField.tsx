import { useEffect, useMemo, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { compare, parseISO, todayMX, toISO, type Ymd } from './date'
import { isoToText, mask, textToISO, useDateFormats } from './format'
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
 * Two days on one grid, typed or clicked. The boxes take the same masked,
 * locale-ordered format as `DateField` — `dd/mm/aaaa` in Spanish — rather
 * than a raw `yyyy-mm-dd` nobody else in the app is asked to type, and they
 * validate the same way: quietly while a day is still half typed, out loud
 * once it is complete.
 *
 * The grid keeps its own rule: first click is the start, second the end,
 * third starts over; a second click before the first swaps them, so
 * "closes before opens" cannot be entered there at all. The typed boxes
 * cannot swap what was typed into them, so they get a rule of their own
 * instead: once both hold a complete, valid day, a closing day before the
 * opening one is reported rather than silently accepted.
 */
export default function RangeField({ id, label, start, end, onChange, min, max, error }: Props) {
  const fmt = useDateFormats()
  const today = useMemo(() => todayMX(), [])
  const lo = useMemo(() => parseISO(min ?? '') ?? today, [min, today])
  const hi = useMemo(() => parseISO(max ?? '') ?? { ...today, y: today.y + 5 }, [max, today])
  const startDay = useMemo(() => parseISO(start), [start])
  const endDay = useMemo(() => parseISO(end), [end])

  const [startText, setStartText] = useState(() => isoToText(start, fmt.dayFirst))
  const [endText, setEndText] = useState(() => isoToText(end, fmt.dayFirst))

  /* The last ISO each box handed up. Same trick as `DateField`: without it,
     the resync effects below cannot tell a prop update (a grid pick, a form
     reset) from the echo of this very box's own rejection of what was
     typed, and would wipe out a half-typed or out-of-range entry the person
     is still fixing. */
  const emittedStart = useRef(start)
  const emittedEnd = useRef(end)

  useEffect(() => {
    if (start === emittedStart.current) return
    emittedStart.current = start
    setStartText(isoToText(start, fmt.dayFirst))
  }, [start, fmt.dayFirst])

  useEffect(() => {
    if (end === emittedEnd.current) return
    emittedEnd.current = end
    setEndText(isoToText(end, fmt.dayFirst))
  }, [end, fmt.dayFirst])

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

  /* A typed day only counts once it is complete and inside the grid's own
     range — half of one, or one outside `min`/`max`, is worth as little as
     the grid refusing to offer it. The box keeps showing what was typed
     either way; only the value the form sees goes back to empty. */
  function onTypeStart(raw: string) {
    const masked = mask(raw)
    setStartText(masked)
    const iso = textToISO(masked, fmt.dayFirst)
    const day = iso === null ? null : parseISO(iso)
    const inRange = day !== null && compare(day, lo) >= 0 && compare(day, hi) <= 0
    const next = iso !== null && inRange ? iso : ''
    emittedStart.current = next
    onChange({ start: next, end })
  }

  function onTypeEnd(raw: string) {
    const masked = mask(raw)
    setEndText(masked)
    const iso = textToISO(masked, fmt.dayFirst)
    const day = iso === null ? null : parseISO(iso)
    const inRange = day !== null && compare(day, lo) >= 0 && compare(day, hi) <= 0
    const next = iso !== null && inRange ? iso : ''
    emittedEnd.current = next
    onChange({ start, end: next })
  }

  /* Each box's own error, exactly as `DateField` derives it: quiet while
     the day is still half typed, `date_invalid` for one that does not
     exist, and the field's usual out-of-range messages for one outside
     `min`/`max`. */
  function localErrorFor(text: string): { day: Ymd | null; error: string | null } {
    const typed = textToISO(text, fmt.dayFirst)
    const day = typed === null ? null : parseISO(typed)
    const complete = text.replace(/\D/g, '').length === 8
    const err = !complete
      ? null
      : day === null
        ? m.date_invalid()
        : compare(day, hi) > 0
          ? m.gate_date_future()
          : compare(day, lo) < 0
            ? m.gate_date_implausible()
            : null
    return { day, error: err }
  }

  const startLocal = localErrorFor(startText)
  const endLocal = localErrorFor(endText)

  // The range's own rule, on top of each box's: only once both sides read as
  // real, in-range days does it make sense to compare them to each other.
  const reversed =
    !startLocal.error && !endLocal.error && startLocal.day && endLocal.day && compare(endLocal.day, startLocal.day) < 0
      ? m.range_reversed()
      : null

  const startShown = startLocal.error
  const endShown = endLocal.error ?? reversed

  const startErrId = `${id}-start-err`
  const endErrId = `${id}-end-err`

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12.5px] font-medium">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="text-[12.5px]">
          <label htmlFor={`${id}-start`} className="eyebrow block">
            {m.range_start()}
          </label>
          <input
            id={`${id}-start`}
            className="fld-input mt-1 font-mono tracking-[0.04em] tabular-nums"
            value={startText}
            placeholder={m.date_placeholder()}
            onChange={(e) => onTypeStart(e.target.value)}
            aria-invalid={Boolean(startShown)}
            aria-describedby={startShown ? startErrId : undefined}
            maxLength={10}
          />
          <p
            id={startErrId}
            className={`mt-1 min-h-[1.45em] text-[11.5px] leading-[1.45] ${startShown ? 'text-bad' : 'text-soft'}`}
          >
            {startShown}
          </p>
        </div>
        <div className="text-[12.5px]">
          <label htmlFor={`${id}-end`} className="eyebrow block">
            {m.range_end()}
          </label>
          <input
            id={`${id}-end`}
            className="fld-input mt-1 font-mono tracking-[0.04em] tabular-nums"
            value={endText}
            placeholder={m.date_placeholder()}
            onChange={(e) => onTypeEnd(e.target.value)}
            aria-invalid={Boolean(endShown)}
            aria-describedby={endShown ? endErrId : undefined}
            maxLength={10}
          />
          <p
            id={endErrId}
            className={`mt-1 min-h-[1.45em] text-[11.5px] leading-[1.45] ${endShown ? 'text-bad' : 'text-soft'}`}
          >
            {endShown}
          </p>
        </div>
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
      <p className={`min-h-[1.45em] text-[11.5px] leading-[1.45] ${error ? 'text-bad' : 'text-soft'}`}>
        {error ?? m.range_hint()}
      </p>
    </div>
  )
}
