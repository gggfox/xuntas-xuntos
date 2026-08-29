import { errorMessage } from '../../lib/registrationErrors'
import type { AppErrorCode } from '../../../convex/lib/errorCodes'

/**
 * One field's error message.
 *
 * It owns the `id` that the input's `aria-describedby` points at, so the two
 * cannot drift apart: whoever renders the input derives the same id from the
 * same field id.
 */
export default function FieldError({ id, code }: { id: string; code?: AppErrorCode }) {
  if (!code) return null
  return (
    <p id={id} className="text-[11.5px] text-bad">
      {errorMessage(code)}
    </p>
  )
}
