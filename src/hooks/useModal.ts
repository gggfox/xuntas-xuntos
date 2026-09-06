import { useCallback, useEffect, useRef } from 'react'

/**
 * The behaviour every `<dialog>` in the app shares: it opens itself as a
 * modal on mount, a click on the backdrop puts it away, and however it goes
 * away the component around it is told exactly once.
 *
 * Escape, the focus trap and the inert page behind are the browser's own and
 * are not re-implemented here. Backdrop dismissal is not: the platform gives
 * a modal `<dialog>` no light-dismiss at all, so it has to be built, and
 * building it once here is what keeps the three dialogs from each growing
 * their own half of it.
 *
 * Two details do the work.
 *
 * A click that lands on the `::backdrop` is reported with the *dialog* as
 * its target — the backdrop is a pseudo-element and cannot be one. So "was
 * that outside?" is answered against the dialog's own box rather than
 * against `event.target`, which would also swallow every click that lands on
 * the dialog's padding.
 *
 * And the gesture is judged on both of its halves. A press that starts on a
 * label inside and finishes past the edge — a fumbled drag, or text being
 * selected — is not a dismissal, so `mousedown` has to have been outside
 * too. That same gate is what keeps a keyboard-driven click (Enter on a
 * button, which the DOM reports at coordinates 0,0 with no `mousedown`
 * before it) from reading as a click on the top-left corner of the page.
 *
 * `dismiss` closes the element AND calls `onClose` itself, rather than
 * closing the element and waiting for the `close` event to carry the news
 * back. That is deliberate. A dialog whose parent renders it conditionally
 * — all three of ours do — stays mounted-but-closed if that event does not
 * arrive, and a mounted-but-closed dialog cannot be reopened: the effect
 * above only runs on mount, so the button that opened it stops doing
 * anything at all. Depending on one event to avoid a dead control is a bet
 * worth not taking, and it is not hypothetical: the browser this was
 * verified in dispatches no `close` event whatsoever, for any dialog. The
 * handler on the element stays as the path for the dismissals the browser
 * performs on its own — Escape, and `cancel` before it — and the guard is
 * what keeps the two paths from reporting the same dismissal twice.
 */
export function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)
  const reported = useRef(false)

  /* Why an effect: `showModal` is an imperative call that must run after the
     element is in the document. */
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const dismiss = useCallback(() => {
    if (reported.current) return
    reported.current = true
    ref.current?.close()
    onClose()
  }, [onClose])

  function outside(ev: React.MouseEvent): boolean {
    const el = ref.current
    if (!el) return false
    const r = el.getBoundingClientRect()
    // A zero-sized box means the element is not laid out — under jsdom, or
    // for one frame before paint. Nothing is outside a box that has no
    // extent, and treating it as such would close the dialog on its own
    // opening click.
    if (r.width === 0 && r.height === 0) return false
    return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom
  }

  return {
    ref,
    /** For the dialog's own buttons: the same dismissal the backdrop performs. */
    close: dismiss,
    dialogProps: {
      ref,
      onClose: dismiss,
      onCancel: dismiss,
      onMouseDown: (ev: React.MouseEvent<HTMLDialogElement>) => {
        pressedOutside.current = outside(ev)
      },
      onClick: (ev: React.MouseEvent<HTMLDialogElement>) => {
        if (pressedOutside.current && outside(ev)) dismiss()
        pressedOutside.current = false
      },
    },
  }
}
