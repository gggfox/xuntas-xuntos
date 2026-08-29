import type { Ymd } from './date'

type Props = {
  years: number[]
  selected: Ymd | null
  min: Ymd
  max: Ymd
  onPick: (year: number) => void
}

/**
 * A page of years. This is the step that makes the field usable at all: a
 * date of birth is twenty-odd years back, and nobody is going to press the
 * month arrow two hundred and fifty times to get there.
 */
export default function YearGrid({ years, selected, min, max, onPick }: Props) {
  return (
    <div className="grid grid-cols-4 gap-[2px]">
      {years.map((year) => (
        <button
          key={year}
          type="button"
          className="cal-cell"
          disabled={year < min.y || year > max.y}
          aria-pressed={selected?.y === year}
          onClick={() => onPick(year)}
        >
          {year}
        </button>
      ))}
    </div>
  )
}
