import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * jsdom implements no scrolling at all, so `scrollIntoView` is simply absent.
 * The form calls it when a failed submit moves focus to the first bad field —
 * real behaviour worth keeping, so the gap is filled here rather than guarded
 * around in the component.
 */
Element.prototype.scrollIntoView ??= () => {}

// Vitest does not unmount between tests on its own, and a left-over tree keeps
// its timers running — which the autosave test would then see.
afterEach(() => {
  cleanup()
})
