import { compare, daysInMonth, type Ymd } from './date'
import type { DateFormats } from './format'

type Props = {
  year: number
  selected: Ymd | null
  min: Ymd
  max: Ymd
  fmt: DateFormats
  onPick: (month: number) => void
}

/** The twelve months of one year. A month is offered if any of its days is. */
export default function MonthGrid({ year, selected, min, max, fmt, onPick }: Props) {
  return (
    <div className="grid grid-cols-4 gap-[2px]">
      {Array.from({ length: 12 }, (_, i) => {
        const month = i + 1
        const last = { y: year, m: month, d: daysInMonth(year, month) }
        const out = compare(last, min) < 0 || compare({ y: year, m: month, d: 1 }, max) > 0
        return (
          <button
            key={month}
            type="button"
            className="cal-cell"
            disabled={out}
            aria-pressed={selected?.y === year && selected?.m === month}
            onClick={() => onPick(month)}
          >
            {fmt.monthShort.format(new Date(Date.UTC(2001, i, 1))).replace('.', '')}
          </button>
        )
      })}
    </div>
  )
}
