import { errorMessage } from '../../lib/registrationErrors'
import type { AppErrorCode } from '../../../convex/lib/errorCodes'

/**
 * One field's error message, in space that is always there.
 *
 * It owns the `id` that the input's `aria-describedby` points at, so the two
 * cannot drift apart: whoever renders the input derives the same id from the
 * same field id.
 *
 * The slot is reserved whether or not there is anything to say. This used to
 * render nothing at all when the field was fine, so every message appearing
 * pushed the rest of the form down as the reader tabbed through it — and in
 * the row of confirmation cards it was worse than annoying: the cards sit in
 * a grid, the message sat under each one, and a card with a two-line message,
 * a card with one line and a card with none all ended up different heights.
 *
 * `lines` is how many lines of message to leave room for. One is right for a
 * field the width of a column; the confirmations are a third of that and
 * their sentences wrap to two.
 */
export default function FieldError({
  id,
  code,
  lines = 1,
}: {
  id: string
  code?: AppErrorCode
  lines?: 1 | 2
}) {
  // Written out rather than built, so Tailwind can see both.
  const reserved = lines === 2 ? 'min-h-[2.9em]' : 'min-h-[1.45em]'
  return (
    <p id={id} className={`text-[11.5px] leading-[1.45] text-bad ${reserved}`}>
      {code ? errorMessage(code) : null}
    </p>
  )
}
