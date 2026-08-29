import { useCallback, useEffect, useRef } from 'react'
import { fingerprint, shouldSaveDraft } from '../lib/draftAutosave'

/**
 * Debounced draft autosave.
 *
 * An eight-section form with a one-page letter cannot be lost because the
 * wifi dropped at the club.
 *
 * Why an effect and not the change handlers: the save is not one interaction,
 * it is the silence after the last of them. Every keystroke has to cancel the
 * timer the one before it started, which is exactly what the cleanup does; a
 * handler would have to hold the same timer in a ref and rebuild the
 * cancelling by hand, in every one of the form's setters.
 *
 * Returns a flush. Leaving a step is a moment where the silence has not
 * arrived yet and the work is finished anyway: filling a step in and pressing
 * "next" inside the debounce window used to lose it if the tab closed. The
 * flush cancels the pending timer rather than racing it — this hook has a
 * history of saving in a loop, and two paths writing `lastSaved` out of order
 * is how that starts.
 */
export function useDraftAutosave<T>({
  values,
  initial,
  enabled,
  delayMs = 1200,
  onSave,
}: {
  values: T
  /**
   * What the server already has. Seeding `lastSaved` with it is what makes
   * opening the form and touching nothing save nothing.
   */
  initial: T
  enabled: boolean
  delayMs?: number
  onSave: (values: T) => void
}): () => void {
  const lastSaved = useRef(fingerprint(initial))
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return
    const next = fingerprint(values)
    if (!shouldSaveDraft(next, lastSaved.current)) return

    const t = setTimeout(() => {
      pending.current = null
      lastSaved.current = next
      onSave(values)
    }, delayMs)
    pending.current = t

    return () => {
      clearTimeout(t)
      if (pending.current === t) pending.current = null
    }
  }, [values, enabled, delayMs, onSave])

  return useCallback(() => {
    if (pending.current !== null) {
      clearTimeout(pending.current)
      pending.current = null
    }
    if (!enabled) return
    const next = fingerprint(values)
    // The same question the effect asks, and the reason flushing on every
    // step change costs nothing when nothing was typed on that step.
    if (!shouldSaveDraft(next, lastSaved.current)) return
    lastSaved.current = next
    onSave(values)
  }, [values, enabled, onSave])
}
