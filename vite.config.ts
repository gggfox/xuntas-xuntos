import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

/**
 * Vite embeds the VITE_* variables into the client bundle during the build,
 * so if they are missing there is no compile error: the container starts and
 * answers 500 on every route. We prefer it to blow up here, where the log
 * gets read.
 *
 * Build only: `vite dev` takes them from .env.local, and there one may well
 * be missing while the project is being set up for the first time.
 */
function requireBuildVariables() {
  const missing = ['VITE_CONVEX_URL', 'VITE_CLERK_PUBLISHABLE_KEY'].filter(
    (k) => !process.env[k],
  )
  if (missing.length > 0) {
    throw new Error(
      `Missing build variables: ${missing.join(', ')}.\n` +
        'They are passed as --build-arg when building the image (see README, "Deployment").',
    )
  }
}

const config = defineConfig(({ command }) => {
  if (command === 'build') requireBuildVariables()

  return {
    // Respects PORT so two branches can run at once without fighting over 3000.
    server: { port: Number(process.env.PORT) || 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tailwindcss(),
      // Compiles the messages into typed functions before the bundle. Runs
      // before TanStack Start so the routes already see src/paraglide.
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        // `url` first: the path prefix wins over the cookie, so a shared link
        // always opens in the language it was shared in.
        //
        // NOTE: `preferredLanguage` is NOT on the list on purpose. `en` exists
        // but is empty; with that strategy, a Mexican family with their
        // browser in English lands on /en/ and sees the interface in Spanish
        // with English URLs. It gets added the day en.json has translations.
        strategy: ['url', 'cookie', 'baseLocale'],
        urlPatterns: [
          {
            pattern: '/:path(.*)?',
            localized: [
              ['es', '/es/:path(.*)?'],
              ['en', '/en/:path(.*)?'],
            ],
          },
        ],
      }),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
