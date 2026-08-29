import * as m from '../../paraglide/messages.js'
import { errorMessage } from '../../lib/registrationErrors'
import type { RegistrationError } from '../../lib/registrationRules'

/**
 * The list at the top of the form, for orientation.
 *
 * Each entry links to the field it is about. The old version rendered a flat
 * list of sentences with nothing to click and nothing marked further down the
 * page, so the reader had to scroll eight sections hunting for the one it
 * meant.
 */
export default function ErrorSummary({
  errors,
  fieldId,
  onSelect,
}: {
  errors: RegistrationError[]
  /** Maps a field path to the DOM id of its input. */
  fieldId: (field: RegistrationError['field']) => string | undefined
  /**
   * Where following an entry goes. The summary cannot do this itself any
   * more: the field it names is very often on a step that is not rendered,
   * and only the orchestrator can put it on screen before focusing it.
   */
  onSelect: (field: RegistrationError['field'], id: string) => void
}) {
  if (errors.length === 0) return null

  return (
    <div
      id="errors"
      role="alert"
      className="mb-8 rounded-[9px] border border-bad/40 bg-bad/5 px-5 py-4"
    >
      <b className="mb-2 block font-disp text-[14.5px] text-bad">{m.reg_errors_title()}</b>
      <ul className="m-0 list-disc pl-5 text-[13px] text-ink-3">
        {errors.map((e) => {
          const id = fieldId(e.field)
          const text = errorMessage(e.code)
          return (
            <li key={`${e.field}:${e.code}`}>
              {id ? (
                <a
                  href={`#${id}`}
                  className="underline"
                  onClick={(ev) => {
                    // Focus, not just scroll: a keyboard reader following this
                    // link must land in the input, not next to it — and on the
                    // step that holds it, which may not be this one.
                    ev.preventDefault()
                    onSelect(e.field, id)
                  }}
                >
                  {text}
                </a>
              ) : (
                text
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
