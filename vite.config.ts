import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { paraglideOptions } from './paraglide.config.mjs'
import { requireBuildVariables } from './scripts/build-env'

const config = defineConfig(({ command }) => {
  if (command === 'build') requireBuildVariables()

  return {
    // Respects PORT so two branches can run at once without fighting over 3000.
    server: { port: Number(process.env.PORT) || 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [
      /*
       * Console piping is off. With it on, the plugin forwards browser
       * console output to the terminal AND terminal output to the browser,
       * so one client warning (Clerk's development-keys notice) comes back
       * as "[Server] …", gets forwarded again, and nests until Vite runs out
       * of heap — about a minute after a tab connects. The devtools panel
       * itself does not need it.
       */
      devtools({ consolePiping: { enabled: false } }),
      tailwindcss(),
      // Compiles the messages into typed functions before the bundle. Runs
      // before TanStack Start so the routes already see src/paraglide. The
      // options live in paraglide.config.mjs because `npm run paraglide`
      // compiles the same project without Vite and has to agree with this.
      paraglideVitePlugin(paraglideOptions),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
