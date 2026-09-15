import { flushSync } from 'react-dom'

/**
 * Runs a state update inside a View Transition, so what it changes on
 * screen animates from the old arrangement to the new one instead of
 * repainting in a frame. `flushSync` is what makes React commit inside the
 * browser's callback rather than after it — without it the transition
 * captures the old screen twice and nothing moves.
 *
 * A plain update where the browser has no such API, or where the reader
 * has asked for less motion. The reduced-motion rule in `styles.css`
 * already switches the transition's own animations off; skipping the
 * capture altogether is simply cheaper than running one for nothing.
 */
export function withViewTransition(update: () => void) {
  if (
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update()
    return
  }
  document.startViewTransition(() => {
    flushSync(update)
  })
}
