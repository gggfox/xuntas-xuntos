import { useEffect, useMemo, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { ageAt } from '../../lib/cycle'
import { compare, parseISO, todayMX, toISO, type Ymd } from './date'
import { isoToText, mask, textToISO, useDateFormats } from './format'
import Calendar from './Calendar'
import Icons from '../Icons'

/**
 * Date field with its own calendar.
 *
 * The browser's date picker is drawn outside the page — no stylesheet reaches
 * it — so on a screen that is otherwise ink on bone paper it shows up as a
 * blue Chrome widget offering the year 2030 for a date of birth. This draws
 * the calendar itself, in the system from `docs/BRAND.md`, and while it was
 * at it, it closed the range: nothing before 1930, nothing after today.
 *
 * Every use of this field asks for a date of birth, and that is why the panel
 * opens eighteen years back when it is empty and why it prints the age
 * underneath. The age is the answer the form is actually after — whether an
 * authorization is needed — and seeing it is what catches the year typed
 * wrong before the server has to say so.
 *
 * This file owns the value and the text box. Where the calendar is in time
 * lives in `Calendar.tsx`; it reports back nothing but the day that was
 * picked.
 */

type Props = {
  id: string
  label: string
  value: string
  onChange: (iso: string) => void
  /**
   * Reported when focus leaves the field, and only then. The text box, the
   * toggle and the calendar grid are one widget as far as the reader is
   * concerned, so a handler on the input alone would fire on the way to the
   * grid and call an empty date wrong while they are still on their way to
   * filling it in.
   */
  onBlur?: () => void
  req?: boolean
  help?: string
  error?: string
  autoComplete?: string
  /** Starts open and stays open after a pick. For screens whose only job is this date. */
  inline?: boolean
  /** ISO bounds. Defaults: 1930-01-01 to today in central Mexico time. */
  min?: string
  max?: string
}

const FLOOR: Ymd = { y: 1930, m: 1, d: 1 }

export default function DateField({
  id,
  label,
  value,
  onChange,
  onBlur,
  req,
  help,
  error,
  autoComplete,
  inline = false,
  min,
  max,
}: Props) {
  const fmt = useDateFormats()

  const today = useMemo(() => todayMX(), [])
  const lo = useMemo(() => parseISO(min ?? '') ?? FLOOR, [min])
  const hi = useMemo(() => parseISO(max ?? '') ?? today, [max, today])
  const selected = useMemo(() => parseISO(value), [value])

  const [text, setText] = useState(() => isoToText(value, fmt.dayFirst))
  const [open, setOpen] = useState(false)

  /* The last ISO this field handed up. Without it, the resync below cannot
     tell a draft loading from its own rejection of a typed date, and wipes
     what the person is still typing. */
  const emitted = useRef(value)
  const rootRef = useRef<HTMLDivElement>(null)

  const panelId = `${id}-cal`
  const errorId = `${id}-err`

  /* The inline panel unfolds on mount instead of being there already: the
     screen assembles itself once, and the movement says the panel is part of
     the field rather than a box that happened to be printed under it.

     Why an effect: `useState(inline)` would open the panel in the first
     render and there would be nothing to animate — the unfold needs a painted
     closed state to move away from, and only a commit gives us one. The
     second render is the point here, not an accident.
     See `.agents/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md`. */
  useEffect(() => {
    if (inline) setOpen(true)
  }, [inline])

  /* The value can change from outside — a draft loading, a form reset.

     Why an effect: `text` cannot be derived from `value`. It is the half-typed
     buffer, and "12/0" has no ISO to come from, so it has to be state of its
     own; the only thing that tells an outside change from the echo of our own
     `emit` is the ref, which must not be written during render. Deriving it,
     or resetting it with a key, deletes what the person is still typing.
     See `.agents/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md`. */
  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    setText(isoToText(value, fmt.dayFirst))
  }, [value, fmt.dayFirst])

  /* A panel that lives inside a form grid closes when you work elsewhere.

     Why an effect: `document` is an external system, and the listener has to
     come off again when the panel closes and when the field unmounts. It is
     bound only while an open, non-inline panel is up — one at a time — so
     there is nothing here for the dedup rule to fold.
     See `.agents/skills/vercel-react-best-practices/rules/client-event-listeners.md`. */
  useEffect(() => {
    if (!open || inline) return
    function onDown(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, inline])

  function emit(iso: string) {
    emitted.current = iso
    onChange(iso)
  }

  function pick(day: Ymd) {
    setText(isoToText(toISO(day), fmt.dayFirst))
    emit(toISO(day))
    if (!inline) setOpen(false)
  }

  function onType(raw: string) {
    const masked = mask(raw)
    setText(masked)
    /* Half a date is not a date yet, and one outside the range is not one
       either: a typed 2026 has to be refused as firmly as the grid refuses
       to offer it, or the only thing that catches it is the server. */
    const iso = textToISO(masked, fmt.dayFirst)
    const day = iso === null ? null : parseISO(iso)
    const inRange = day !== null && compare(day, lo) >= 0 && compare(day, hi) <= 0
    emit(iso !== null && inRange ? iso : '')
  }

  /* What is wrong with what was typed, if the caller has not said already. */
  const typed = textToISO(text, fmt.dayFirst)
  const typedDay = typed === null ? null : parseISO(typed)
  const complete = text.replace(/\D/g, '').length === 8
  const localError = !complete
    ? null
    : typedDay === null
      ? m.date_invalid()
      : compare(typedDay, hi) > 0
        ? m.gate_date_future()
        : compare(typedDay, lo) < 0
          ? m.gate_date_implausible()
          : null
  const shown = error ?? localError
  const age = selected ? ageAt(value) : -1

  const describedBy = [shown ? errorId : null, help ? `${id}-help` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-1.5"
      onBlur={(ev) => {
        /* React's onBlur bubbles, so this sees focus leaving any part of the
           widget. Where focus went is what separates leaving the field from
           moving around inside it. A null relatedTarget — a click on dead
           space, or the window losing focus — really is leaving. */
        if (rootRef.current?.contains(ev.relatedTarget)) return
        onBlur?.()
      }}
      onKeyDown={(ev) => {
        if (ev.key === 'Escape' && open && !inline) setOpen(false)
      }}
    >
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className="fld-input pr-[44px] font-mono tracking-[0.04em] tabular-nums"
          placeholder={m.date_placeholder()}
          value={text}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => !inline && setOpen(true)}
          aria-invalid={Boolean(shown)}
          aria-describedby={describedBy || undefined}
          autoComplete={autoComplete}
          maxLength={10}
        />
        <button
          type="button"
          className="cal-nav absolute top-1/2 right-[7px] h-[30px] w-[30px] -translate-y-1/2"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? m.date_close() : m.date_open()}
        >
          <Icons.Calendar />
        </button>
      </div>

      <div className="cal-reveal" data-open={open}>
        <div>
          <Calendar
            id={panelId}
            label={label}
            selected={selected}
            today={today}
            min={lo}
            max={hi}
            openAt={{ y: today.y - 18, m: today.m, d: today.d }}
            fmt={fmt}
            onPick={pick}
          />
        </div>
      </div>

      {age >= 0 && (
        <p className="cal-read">
          <b>{m.date_age({ age })}</b>
          <span aria-hidden="true">·</span>
          <span>{age < 18 ? m.date_age_minor() : m.date_age_adult()}</span>
        </p>
      )}

      {shown && (
        <p id={errorId} className="text-[11.5px] text-bad">
          {shown}
        </p>
      )}
      {help && !shown && (
        <p id={`${id}-help`} className="text-[11.5px] text-soft">
          {help}
        </p>
      )}
    </div>
  )
}
