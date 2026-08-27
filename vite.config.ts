import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    // Compila los mensajes a funciones tipadas antes del bundle. Corre antes
    // que TanStack Start para que las rutas ya vean src/paraglide.
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      // `url` primero: el prefijo de ruta manda sobre la cookie y sobre el
      // idioma del navegador, para que un enlace compartido siempre abra en el
      // idioma con el que se compartió.
      strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
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
})

export default config
