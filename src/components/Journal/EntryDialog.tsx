import { useId, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { BODY_LIMIT, SCORE_LIMIT, TITLE_LIMIT, todayISO, validateEntry, type EntryInput, type EntryKind } from '../../../convex/lib/journalRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'
import { useModal } from '../../hooks/useModal'
import DateField from '../DateField'
import Segmented from '../Segmented'

type Props = {
  /** Present when editing; absent for a new entry. */
  initial?: EntryInput
  onSubmit: (input: EntryInput) => Promise<unknown>
  onClose: () => void
}

/**
 * Writing an entry, as a dialog rather than a composer that stands open at
 * the top of the page. The prototype kept the form always visible; an
 * athlete writes once a week and reads the rest of the time, and a form
 * that size, permanently, is the page telling them the wrong thing about
 * what it is for.
 *
 * Same skeleton as `InviteDialog`: native `<dialog>`, local rules first,
 * the server's code second, close on success.
 */
export default function EntryDialog({ initial, onSubmit, onClose }: Props) {
  const { close, dialogProps } = useModal(onClose)
  const [kind, setKind] = useState<EntryKind>(initial?.kind ?? 'tournament')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [score, setScore] = useState(initial?.score ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const titleId = useId()
  const fieldId = useId()
  const today = todayISO()

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const input: EntryInput = { kind, title, date, body, score: kind === 'tournament' ? score : undefined }
    const problem = validateEntry(input, today)
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(input)
      close()
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  const near = body.length > BODY_LIMIT * 0.92

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className="card m-auto w-[min(64ch,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-y-auto px-[21px] py-[19px]"
    >
      <form onSubmit={submit} noValidate>
        <b id={titleId} className="block font-disp text-[16px]">
          {initial ? m.journal_edit_entry() : m.journal_new_entry()}
        </b>

        <div className="mt-4">
          <Segmented
            name={`${fieldId}-kind`}
            label={m.journal_kind_label()}
            value={kind}
            items={[
              { id: 'tournament', label: m.journal_kind_tournament() },
              { id: 'training', label: m.journal_kind_training() },
            ]}
            onChange={setKind}
          />
        </div>

        <label htmlFor={`${fieldId}-title`} className="mt-4 block text-[12.5px] font-medium">
          {m.journal_field_title()} <span className="text-bad">*</span>
        </label>
        <input
          id={`${fieldId}-title`}
          className="fld-input mt-1.5"
          value={title}
          maxLength={TITLE_LIMIT}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          autoFocus
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <DateField
              id={`${fieldId}-date`}
              label={m.journal_field_date()}
              value={date}
              onChange={setDate}
              req
              min="2000-01-01"
              max={today}
              openAt={today}
            />
          </div>
          {kind === 'tournament' && (
            <div className="sm:w-[16ch]">
              <label htmlFor={`${fieldId}-score`} className="block text-[12.5px] font-medium">
                {m.journal_field_score()}
              </label>
              <input
                id={`${fieldId}-score`}
                className="fld-input mt-1.5 font-mono tabular-nums"
                value={score}
                maxLength={SCORE_LIMIT}
                placeholder="71-74-70"
                onChange={(e) => setScore(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <label htmlFor={`${fieldId}-body`} className="mt-4 block text-[12.5px] font-medium">
          {m.journal_field_body()} <span className="text-bad">*</span>
        </label>
        <textarea
          id={`${fieldId}-body`}
          className="fld-input mt-1.5 min-h-[180px] resize-y leading-[1.65]"
          value={body}
          maxLength={BODY_LIMIT}
          placeholder={m.journal_body_hint()}
          onChange={(e) => setBody(e.target.value)}
          aria-describedby={`${fieldId}-count`}
        />
        <p id={`${fieldId}-count`} className={`mt-1.5 font-mono text-[11.5px] ${near ? 'text-warn' : 'text-soft'}`}>
          {m.reg_letter_counter({ count: body.length, limit: BODY_LIMIT })}
        </p>

        <p className="mt-2 min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? m.common_loading() : m.journal_save()}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => close()}>
            {m.staff_cancel()}
          </button>
        </div>
      </form>
    </dialog>
  )
}
