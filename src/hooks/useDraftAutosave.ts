import { useEffect, useRef } from 'react'
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
}): void {
  const lastSaved = useRef(fingerprint(initial))

  useEffect(() => {
    if (!enabled) return
    const next = fingerprint(values)
    if (!shouldSaveDraft(next, lastSaved.current)) return

    const t = setTimeout(() => {
      lastSaved.current = next
      onSave(values)
    }, delayMs)
    return () => clearTimeout(t)
  }, [values, enabled, delayMs, onSave])
}
