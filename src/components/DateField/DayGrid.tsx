import type { RefObject } from 'react'
import { compare, daysInMonth, firstWeekday, isSame, type Ymd } from './date'
import { utc, type DateFormats } from './format'

type Props = {
  /** The month on screen; its day is where the arrow keys are sitting. */
  cursor: Ymd
  selected: Ymd | null
  today: Ymd
  min: Ymd
  max: Ymd
  fmt: DateFormats
  onPick: (day: Ymd) => void
  /** Put on the cursor's cell so the arrow keys can carry focus with them. */
  cursorRef: RefObject<HTMLButtonElement | null>
  /** The other end of a range, when this grid is picking one. Absent for a
      single-day field — every caller but `RangeField` leaves it out, and the
      grid then behaves exactly as it did before ranges existed. */
  rangeEnd?: Ymd | null
}

/**
 * One month. The cells before the 1st are empty rather than filled with the
 * previous month's tail: on paper a calendar starts where the month starts,
 * and greyed-out neighbours are only there to fill a rectangle.
 */
export default function DayGrid({
  cursor,
  selected,
  today,
  min,
  max,
  fmt,
  onPick,
  cursorRef,
  rangeEnd = null,
}: Props) {
  const lead = (firstWeekday(cursor.y, cursor.m) - fmt.weekStart + 7) % 7

  return (
    <>
      <div className="grid grid-cols-7 gap-[2px]">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="cal-wd">
            {fmt.weekday
              .format(new Date(Date.UTC(2024, 0, 7 + ((fmt.weekStart + i) % 7))))
              .replace('.', '')
              .slice(0, 2)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth(cursor.y, cursor.m) }, (_, i) => {
          const day: Ymd = { y: cursor.y, m: cursor.m, d: i + 1 }
          const out = compare(day, min) < 0 || compare(day, max) > 0
          const isCursor = day.d === cursor.d
          /* Which end of a range this cell is, if any. Only asked when both
             ends are known — a lone `selected` is a single-day pick, not a
             range whose second end has not arrived yet. */
          const range =
            selected && rangeEnd
              ? isSame(day, selected)
                ? 'start'
                : isSame(day, rangeEnd)
                  ? 'end'
                  : compare(day, selected) > 0 && compare(day, rangeEnd) < 0
                    ? 'mid'
                    : undefined
              : undefined
          return (
            <button
              key={day.d}
              ref={isCursor ? cursorRef : undefined}
              type="button"
              className="cal-day"
              disabled={out}
              tabIndex={isCursor ? 0 : -1}
              data-today={isSame(day, today)}
              data-range={range}
              aria-pressed={isSame(day, selected) || isSame(day, rangeEnd)}
              aria-current={isSame(day, today) ? 'date' : undefined}
              aria-label={fmt.full.format(utc(day))}
              onClick={() => onPick(day)}
            >
              {day.d}
            </button>
          )
        })}
      </div>
    </>
  )
}
