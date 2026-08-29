import { useEffect, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { addDays, addMonths, clamp, compare, daysInMonth, type Ymd } from './date'
import { utc, type DateFormats } from './format'
import { VIEWS, type View } from './views'
import Icons from '../Icons'
import DayGrid from './DayGrid'
import MonthGrid from './MonthGrid'
import YearGrid from './YearGrid'

type Props = {
  id: string
  /** Names the panel for a screen reader; the field's own label. */
  label: string
  selected: Ymd | null
  today: Ymd
  min: Ymd
  max: Ymd
  /** Month to show while nothing is selected yet. */
  openAt: Ymd
  fmt: DateFormats
  onPick: (day: Ymd) => void
}

/** Years shown per page of the year view: four columns of six. */
const YEARS_PER_PAGE = 24

/**
 * The calendar itself: three views over one month cursor.
 *
 * Where it is in time is nobody else's business, so all of it lives here —
 * the field above only ever hears which day was picked.
 */
export default function Calendar({
  id,
  label,
  selected,
  today,
  min,
  max,
  openAt,
  fmt,
  onPick,
}: Props) {
  const [view, setView] = useState<View>('days')
  /* The month on screen, and the day the arrow keys are sitting on. */
  const [cursor, setCursor] = useState<Ymd>(() => clamp(selected ?? openAt, min, max))
  const [yearPage, setYearPage] = useState(() => pageOf(cursor.y, min.y))
  /* Which way time moved, so the grid slides in from that side. */
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  /* Bumped on every step so the entrance animation replays. */
  const [tick, setTick] = useState(0)

  const cursorRef = useRef<HTMLButtonElement>(null)
  const wantsFocus = useRef(false)

  /* Follow the date the field reports — typed, pasted, or loaded from a
     draft — so the grid is never showing a month nobody asked for.

     Why an effect: `cursor` is not derived from `selected`. The arrows and the
     month buttons move it on their own, and it has to stay put while
     `selected` goes null on a half-typed date, so it cannot be recomputed
     during render. Remounting on a key would reset the view and the year page
     along with it.
     See `.agents/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md`. */
  useEffect(() => {
    if (selected) setCursor(selected)
  }, [selected])

  /* Put the focus on the day the arrow keys just walked to.

     Why an effect and not the key handler: the button for the new cursor does
     not exist until the render that `setCursor` schedules has committed, so
     the focus call has to wait for it. The ref keeps it to keyboard travel —
     picking a month or opening the panel with the mouse must not pull the
     focus away.
     See `.agents/skills/vercel-react-best-practices/rules/rerender-move-effect-to-event.md`. */
  useEffect(() => {
    if (!wantsFocus.current) return
    wantsFocus.current = false
    cursorRef.current?.focus()
  }, [cursor, view])

  function travel(back: boolean) {
    setDir(back ? 'back' : 'fwd')
    setTick((n) => n + 1)
  }

  /* Picking in a coarse view is a way in, not an answer: it drops to the next
     finer view and reports nothing up. See `views.ts` for the chain. */
  function drill() {
    travel(false)
    const next = VIEWS[view].drillsTo
    if (next) setView(next)
  }

  function step(months: number) {
    travel(months < 0)
    setCursor(clamp(addMonths(cursor, months), min, max))
  }

  function moveCursor(days: number) {
    const next = addDays(cursor, days)
    if (compare(next, min) < 0 || compare(next, max) > 0) return
    if (next.y !== cursor.y || next.m !== cursor.m) travel(days < 0)
    /* The focus goes with the cursor, or the arrows would walk away from the
       cell the ring is still drawn around. */
    wantsFocus.current = true
    setCursor(next)
  }

  function onKeyDown(ev: React.KeyboardEvent) {
    if (view !== 'days') return
    const jump: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    if (ev.key in jump) {
      ev.preventDefault()
      moveCursor(jump[ev.key])
    } else if (ev.key === 'PageUp' || ev.key === 'PageDown') {
      ev.preventDefault()
      step(ev.key === 'PageUp' ? -1 : 1)
    }
  }

  const years = yearsOf(yearPage, min.y)
  const stepsMonths = view !== 'years'
  const before = addMonths(cursor, -1)
  const after = addMonths(cursor, 1)

  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      className="cal-panel"
      onKeyDown={onKeyDown}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="cal-nav"
          onClick={() => (stepsMonths ? step(-1) : pageYears(-1))}
          /* A step is offered only if some day of the month it lands on is in range. */
          disabled={
            view === 'days' && compare({ ...before, d: daysInMonth(before.y, before.m) }, min) < 0
          }
          aria-label={stepsMonths ? m.date_prev_month() : m.date_prev_years()}
        >
          <Icons.Chevron dir="left" />
        </button>

        <button
          type="button"
          className="cal-title"
          onClick={() => {
            setYearPage(pageOf(cursor.y, min.y))
            setView((v) => (v === 'days' ? 'years' : 'days'))
            setTick((n) => n + 1)
          }}
          aria-expanded={view !== 'days'}
          aria-label={m.date_pick_month_year()}
        >
          <span aria-live="polite">
            {view === 'years'
              ? `${years[0]} — ${years[years.length - 1]}`
              : view === 'months'
                ? cursor.y
                : `${fmt.monthLong.format(utc(cursor))} ${cursor.y}`}
          </span>
          <Icons.Chevron dir="down" />
        </button>

        <button
          type="button"
          className="cal-nav"
          onClick={() => (stepsMonths ? step(1) : pageYears(1))}
          disabled={view === 'days' && compare({ ...after, d: 1 }, max) > 0}
          aria-label={stepsMonths ? m.date_next_month() : m.date_next_years()}
        >
          <Icons.Chevron dir="right" />
        </button>
      </div>

      {/* The key remounts the page so its entrance animation replays. */}
      <div key={`${view}-${tick}`} className="cal-page" data-dir={dir}>
        {view === 'days' && (
          <DayGrid
            cursor={cursor}
            selected={selected}
            today={today}
            min={min}
            max={max}
            fmt={fmt}
            onPick={onPick}
            cursorRef={cursorRef}
          />
        )}

        {view === 'months' && (
          <MonthGrid
            year={cursor.y}
            selected={selected}
            min={min}
            max={max}
            fmt={fmt}
            onPick={(month) => {
              setCursor((c) => ({ y: c.y, m: month, d: Math.min(c.d, daysInMonth(c.y, month)) }))
              drill()
            }}
          />
        )}

        {view === 'years' && (
          <YearGrid
            years={years}
            selected={selected}
            min={min}
            max={max}
            onPick={(year) => {
              setCursor((c) => ({ ...c, y: year, d: Math.min(c.d, daysInMonth(year, c.m)) }))
              drill()
            }}
          />
        )}
      </div>
    </div>
  )

  function pageYears(delta: number) {
    travel(delta < 0)
    setYearPage((p) => Math.max(0, p + delta))
  }
}

const pageOf = (year: number, floor: number) =>
  Math.max(0, Math.floor((year - floor) / YEARS_PER_PAGE))

const yearsOf = (page: number, floor: number) =>
  Array.from({ length: YEARS_PER_PAGE }, (_, i) => floor + page * YEARS_PER_PAGE + i)
