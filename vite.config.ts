import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

const config = defineConfig({
  // Respeta PORT para poder levantar dos ramas a la vez sin pelearse el 3000.
  server: { port: Number(process.env.PORT) || 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    // Compila los mensajes a funciones tipadas antes del bundle. Corre antes
    // que TanStack Start para que las rutas ya vean src/paraglide.
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      // `url` primero: el prefijo de ruta manda sobre la cookie, para que un
      // enlace compartido siempre abra en el idioma con el que se compartió.
      //
      // OJO: `preferredLanguage` NO está en la lista a propósito. `en` existe
      // pero está vacío; con esa estrategia, una familia mexicana con el
      // navegador en inglés aterriza en /en/ y ve la interfaz en español con
      // URLs en inglés. Se agrega el día que en.json tenga traducciones.
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
})

export default config
