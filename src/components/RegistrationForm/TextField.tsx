import FieldError from './FieldError'
import type { AppErrorCode } from '../../../convex/lib/errorCodes'

/**
 * A labelled text input that knows how to be wrong.
 *
 * It takes an error *code*, not a sentence: the component stays free of
 * prose, and `FieldError` is the one place a code becomes words.
 */
export default function TextField({
  id,
  label,
  req,
  help,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
}: {
  id: string
  label: string
  req?: boolean
  help?: string
  type?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: AppErrorCode
  autoComplete?: string
}) {
  const errorId = `${id}-err`
  const helpId = `${id}-help`
  const describedBy = [error ? errorId : null, help ? helpId : null].filter(Boolean).join(' ')

  return (
    <div className="mb-[2px] flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>
      <input
        id={id}
        type={type}
        className="fld-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
      />
      {help && (
        <p id={helpId} className="text-[11.5px] text-soft">
          {help}
        </p>
      )}
      <FieldError id={errorId} code={error} />
    </div>
  )
}
