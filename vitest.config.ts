import { defineConfig } from 'vitest/config'

/**
 * A config separate from `vite.config.ts` on purpose.
 *
 * The production one drags in TanStack Start and Paraglide, and demands the
 * build variables. None of that is needed to test pure functions, and
 * loading it would make the tests slow and fragile.
 */
export default defineConfig({
  test: {
    projects: [
      {
        // Pure logic. No DOM, so it stays fast.
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        /**
         * No `@vitejs/plugin-react` here. Vitest bundles its own Vite, so the
         * plugin's types clash with the rolldown-based Vite 8 the app builds
         * with — and it is not needed: esbuild reads `jsx: react-jsx` from
         * tsconfig and transforms the JSX on its own. The plugin's real job,
         * Fast Refresh, means nothing to a test run.
         */
        test: {
          name: 'components',
          include: ['tests/components/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
  },
})
