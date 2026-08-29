import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest does not unmount between tests on its own, and a left-over tree keeps
// its timers running — which the autosave test would then see.
afterEach(() => {
  cleanup()
})
