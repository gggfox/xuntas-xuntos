import * as m from '../../paraglide/messages.js'
import FieldError from './FieldError'
import { LETTER_LIMIT } from '../../lib/registrationSchema'
import type { AppErrorCode } from '../../../convex/lib/errorCodes'

/**
 * The motivation letter, with its character counter.
 *
 * The counter turns amber near the cap rather than only at it, so the writer
 * finds out while there is still room to edit. The cap is enforced here as
 * well as on the server, which it was not before: the client let you type past
 * it and the rejection only arrived at submit, with the letter already written.
 */
export default function LetterField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: AppErrorCode
}) {
  const errorId = `${id}-err`
  const countId = `${id}-count`
  const near = value.length > LETTER_LIMIT * 0.92

  return (
    <>
      <textarea
        id={id}
        className="fld-input min-h-[240px] resize-y leading-[1.65]"
        value={value}
        maxLength={LETTER_LIMIT}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={[error ? errorId : null, countId].filter(Boolean).join(' ')}
      />
      <p
        id={countId}
        className={`mt-1.5 font-mono text-[11.5px] ${near ? 'text-warn' : 'text-soft'}`}
      >
        {m.reg_letter_counter({ count: value.length, limit: LETTER_LIMIT })}
      </p>
      <FieldError id={errorId} code={error} />
    </>
  )
}
