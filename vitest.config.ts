import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * A config separate from `vite.config.ts` on purpose.
 *
 * The production one drags in TanStack Start and Paraglide, and demands the
 * build variables. None of that is needed to test pure functions, and
 * loading it would make the tests slow and fragile.
 */
export default defineConfig({
  test: {
    /**
     * The development escape hatch opens the registration window no matter
     * what. If someone has it set in their shell, the `isWindowOpen` tests
     * would fail because of the environment and not because of the code.
     */
    env: { WINDOW_ALWAYS_OPEN: '' },
    projects: [
      {
        // Pure logic. No DOM, so it stays fast.
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
          env: { WINDOW_ALWAYS_OPEN: '' },
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'components',
          include: ['tests/components/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          env: { WINDOW_ALWAYS_OPEN: '' },
        },
      },
    ],
  },
})
