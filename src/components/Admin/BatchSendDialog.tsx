import { useEffect, useId, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { describeConvexError } from '../../lib/registrationErrors'

type Props = {
  count: number
  windowOpen: boolean
  onConfirm: () => Promise<{ scheduled: number; skipped: number }>
  onTest: () => Promise<void>
  onClose: () => void
}

/**
 * The one dialog in the app, native `<dialog>` so focus and Escape are the
 * browser's. It says the count, refuses while the window is open, and offers
 * a test send — ten lines that stop a typo going to two hundred families.
 *
 * `onConfirm` resolves with `{ scheduled, skipped }`: the mutation only
 * queues the sends, it does not wait on Resend, so the note it prints is
 * careful to say "scheduled" and never claims the mail has gone out.
 */
export default function BatchSendDialog({ count, windowOpen, onConfirm, onTest, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // The `<b>` below needs a stable id for `aria-labelledby` — the dialog is
  // the highest-stakes control in the panel, and a native `<dialog>` gets no
  // accessible name of its own from `showModal` alone.
  const titleId = useId()

  /* Why an effect: showModal is an imperative browser call that must run after mount. */
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="card m-auto max-w-[52ch] px-[21px] py-[19px] backdrop:bg-ink/40"
    >
      <b id={titleId} className="block font-disp text-[16px]">{m.batch_title({ n: count })}</b>
      <p className="mt-2 text-[13px] font-light text-soft">
        {windowOpen ? m.batch_window_open() : m.batch_text({ n: count })}
      </p>
      {note && <p className="mt-2 text-[12.5px] text-soft">{note}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn"
          disabled={busy || windowOpen || count === 0}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await onConfirm()
              setNote(m.batch_done({ scheduled: r.scheduled, skipped: r.skipped }))
            } catch (err) {
              // Reported inside the dialog, not the page behind it: this
              // dialog is in the top layer over an inert backdrop, so a
              // message printed anywhere else is one the operator cannot
              // see while it's open.
              setNote(describeConvexError(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          {m.batch_confirm()}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onTest()
              setNote(m.batch_test_sent())
            } catch (err) {
              // Without this catch, a rejected `sendTest` escaped this
              // async handler as an unhandled promise and the button that
              // exists purely to build confidence before an irreversible
              // batch did nothing at all when it failed.
              setNote(describeConvexError(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          {m.batch_test()}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
          {m.common_back()}
        </button>
      </div>
    </dialog>
  )
}
