import FieldError from './FieldError'
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
    <div className="mb-[15px] flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>
      <select
        id={id}
        className="fld-input"
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
      {help && (
        <p id={helpId} className="text-[11.5px] text-soft">
          {help}
        </p>
      )}
      <FieldError id={errorId} code={error} />
    </div>
  )
}
