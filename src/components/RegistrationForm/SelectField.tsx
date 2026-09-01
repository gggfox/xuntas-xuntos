import FieldError from './FieldError'
import { Icons } from '../Icons'
import type { AppErrorCode } from '../../../convex/lib/errorCodes'

export default function SelectField({
  id,
  label,
  req,
  help,
  value,
  onChange,
  onBlur,
  error,
  options,
}: {
  id: string
  label: string
  req?: boolean
  help?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: AppErrorCode
  options: Array<{ v: string; t: string }>
}) {
  const errorId = `${id}-err`
  const helpId = `${id}-help`
  const describedBy = [error ? errorId : null, help ? helpId : null].filter(Boolean).join(' ')

  return (
    <div className="mb-[2px] flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>
      {/* The chevron is ours, not the browser's. A native select draws its
          arrow hard against the right edge, inside the padding rather than
          after it, so it sat on the border; `appearance-none` drops it and
          the icon below takes its place, inset by the same 12px the text is.
          It is `pointer-events-none` so a click on the arrow still opens the
          select, which is what a reader aiming at it expects. */}
      <div className="relative">
        <select
          id={id}
          className="fld-input appearance-none pr-[38px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
        >
          {options.map((o) => (
            <option key={o.v} value={o.v}>
              {o.t}
            </option>
          ))}
        </select>
        <Icons.Chevron
          dir="down"
          className="pointer-events-none absolute top-1/2 right-[12px] -translate-y-1/2 text-soft"
        />
      </div>
      {help && (
        <p id={helpId} className="text-[11.5px] text-soft">
          {help}
        </p>
      )}
      <FieldError id={errorId} code={error} />
    </div>
  )
}
