import { useEffect, useMemo, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { compare, daysInMonth, parseMonth, todayMX, toMonthISO, type Ymd } from './date'
import { maskMonth, monthISOToText, textToMonthISO, useDateFormats } from './format'
import Calendar from './Calendar'
import Icons from '../Icons'

/**
 * Month field with a calendar in a popover.
 *
 * `DateField`'s sibling rather than a mode of it, because the two disagree on
 * every question the widget answers. That one asks for a day two decades back
 * and keeps its grid open beside the field, because paging that far is a lot
 * of work to ask of a panel nobody can see is there. This one asks which
 * month a tournament falls in — a step ahead, not decades back — from inside
 * a row that repeats, where a panel standing open would push every row under
 * it off the screen. So the panel is a popover: closed until it is asked for,
 * drawn over the page rather than in it, and gone once it has answered.
 *
 * What the two do share is the walk through years and months, and that lives
 * in `Calendar.tsx` for both. The month grid is where this one's funnel ends
 * (`views.ts`), so the day grid never mounts and the answer comes back as the
 * 1st, which this file drops on the way to storage.
 *
 * The value is `yyyy-mm`: one segment shorter than a date of birth, and the
 * only shape the field will emit. A month half typed, impossible, or outside
 * the range reports empty, the same way the day field refuses a year nobody
 * offered — otherwise the only thing that catches it is the server.
 */

type Props = {
  id: string
  label: string
  /** `yyyy-mm`, or empty. */
  value: string
  onChange: (iso: string) => void
  /**
   * Reported when focus leaves the field, and only then. The text box, the
   * toggle and the popover are one widget as far as the reader is concerned,
   * so a handler on the input alone would fire on the way to the grid.
   */
  onBlur?: () => void
  /**
   * Drops the printed label and puts it on the box for a screen reader
   * instead. For the repeating rows of the competitive calendar, where the
   * column heading is the label and repeating it per row is noise.
   */
  hideLabel?: boolean
  req?: boolean
  error?: string
  /** `yyyy-mm` bounds, both inclusive. */
  min: string
  max: string
}

export default function MonthField({
  id,
  label,
  value,
  onChange,
  onBlur,
  hideLabel = false,
  req,
  error,
  min,
  max,
}: Props) {
  const fmt = useDateFormats()
  const today = useMemo(() => todayMX(), [])

  const lo = useMemo(() => parseMonth(min) ?? { y: 1930, m: 1, d: 1 }, [min])
  /* The end of the last month offered, not its 1st: the grids compare whole
     days, and a max of "the 1st" would put the other thirty out of range. */
  const hi = useMemo(() => {
    const p = parseMonth(max) ?? { y: 2100, m: 12, d: 1 }
    return { y: p.y, m: p.m, d: daysInMonth(p.y, p.m) }
  }, [max])
  const selected = useMemo(() => parseMonth(value), [value])

  const [text, setText] = useState(() => monthISOToText(value))
  const [open, setOpen] = useState(false)
  /* Whether the reader has walked away from the box since last typing in it.
     A month half typed is not worth interrupting them over — `11/20` is a
     perfectly good `11/2026` two keystrokes from now — but a month half typed
     and *left* is worth a word, and this is what tells the two apart. */
  const [left, setLeft] = useState(false)

  /* The last value this field handed up. Without it, the resync below cannot
     tell a draft loading from its own rejection of a typed month, and wipes
     what the person is still typing. */
  const emitted = useRef(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLInputElement>(null)
  /* Set when the panel is dismissed by the keyboard, so the focus it was
     holding comes back to the box rather than to the top of the document. */
  const wantsFocus = useRef(false)

  const panelId = `${id}-cal`
  const errorId = `${id}-err`

  /* The value can change from outside — a draft loading, a form reset.

     Why an effect: `text` cannot be derived from `value`. It is the half-typed
     buffer, and "10/20" has no month to come from, so it has to be state of
     its own; the only thing that tells an outside change from the echo of our
     own `emit` is the ref, which must not be written during render.
     See `.agents/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md`. */
  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    setText(monthISOToText(value))
  }, [value])

  /* Put the focus back on the box after Escape closed the panel.

     Why an effect and not the key handler: the panel still holds the focus
     while the handler runs, and moving it before React has unmounted the
     panel loses the race.
     See `.agents/skills/vercel-react-best-practices/rules/rerender-move-effect-to-event.md`. */
  useEffect(() => {
    if (open || !wantsFocus.current) return
    wantsFocus.current = false
    boxRef.current?.focus()
  }, [open])

  function emit(iso: string) {
    emitted.current = iso
    onChange(iso)
  }

  function pick(day: Ymd) {
    setText(monthISOToText(toMonthISO(day)))
    emit(toMonthISO(day))
    /* The popover has answered the only question it was opened for. Leaving
       it standing would cover the row under this one. */
    wantsFocus.current = true
    setOpen(false)
  }

  function onType(raw: string) {
    const masked = maskMonth(raw)
    setText(masked)
    setLeft(false)
    const iso = textToMonthISO(masked)
    const month = iso === null ? null : parseMonth(iso)
    const inRange = month !== null && compare(month, lo) >= 0 && compare(month, hi) <= 0
    emit(iso !== null && inRange ? iso : '')
  }

  /* What is wrong with what was typed, if the caller has not said already.
     A month that is not whole emits nothing, so saying nothing about it would
     leave the reader looking at `11/206` in a box the form has stored nothing
     for — which is exactly what the free-text box this replaced would at
     least have kept. An empty box is not that: leaving this step blank is a
     fair answer, and there is nothing to finish. */
  const typed = textToMonthISO(text)
  const typedMonth = typed === null ? null : parseMonth(typed)
  const digits = text.replace(/\D/g, '').length
  const complete = digits === 6
  const localError = !complete
    ? left && digits > 0
      ? m.date_month_incomplete()
      : null
    : typedMonth === null
      ? m.date_month_invalid()
      : compare(typedMonth, lo) < 0
        ? m.date_month_past()
        : compare(typedMonth, hi) > 0
          ? m.date_month_far()
          : null
  const shown = error ?? localError

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
        setOpen(false)
        setLeft(true)
        onBlur?.()
      }}
      onKeyDown={(ev) => {
        if (ev.key !== 'Escape' || !open) return
        /* Swallowed, or the wizard would read it as a request to leave the
           step behind the popover. */
        ev.stopPropagation()
        wantsFocus.current = true
        setOpen(false)
      }}
    >
      {!hideLabel && (
        <label htmlFor={id} className="text-[12.5px] font-medium">
          {label} {req && <span className="text-bad">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={boxRef}
          id={id}
          type="text"
          inputMode="numeric"
          className="fld-input pr-[36px] font-mono tracking-[0.04em] tabular-nums"
          placeholder={m.date_month_placeholder()}
          value={text}
          onChange={(e) => onType(e.target.value)}
          aria-label={hideLabel ? label : undefined}
          aria-invalid={Boolean(shown)}
          aria-describedby={shown ? errorId : undefined}
          maxLength={7}
        />
        <button
          type="button"
          className="cal-nav absolute top-1/2 right-[5px] h-[26px] w-[26px] -translate-y-1/2"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={open ? m.date_close_months() : m.date_open_months()}
        >
          <Icons.Calendar />
        </button>

        {/* Unmounted rather than hidden: a panel left in the tree keeps its
            month grid in the tab order behind the row, and the reader who
            never opened it has no way to know why Tab went quiet. */}
        {open && (
          <div className="cal-pop">
            <Calendar
              id={panelId}
              label={label}
              selected={selected}
              today={today}
              min={lo}
              max={hi}
              openAt={lo}
              fmt={fmt}
              grain="month"
              onPick={pick}
            />
          </div>
        )}
      </div>

      {/* Reserved whether or not there is anything to say, so a message
          appearing does not shove the rows under this one down the page. */}
      <p id={errorId} className="min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">
        {shown ?? null}
      </p>
    </div>
  )
}
