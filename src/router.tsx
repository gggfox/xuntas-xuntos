import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { deLocalizeUrl, localizeUrl } from './paraglide/runtime.js'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    /**
     * Prefijo de idioma en la URL.
     *
     * `input` quita el prefijo antes de emparejar rutas, así que los archivos
     * en src/routes se escriben sin `/es`. `output` lo vuelve a poner al
     * generar enlaces, para que lo que se comparte por WhatsApp abra en el
     * idioma con el que se compartió.
     */
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
