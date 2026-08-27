import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { deLocalizeUrl, localizeUrl } from './paraglide/runtime.js'
import PantallaError from './components/PantallaError'
import PantallaNoEncontrada from './components/PantallaNoEncontrada'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    /**
     * Sin estos dos, un error de render deja la página en blanco y una URL mal
     * escrita deja al navegador con la pantalla en blanco también. En una app
     * que se comparte por WhatsApp, los enlaces llegan cortados a menudo.
     */
    defaultErrorComponent: ({ error }) => <PantallaError error={error} />,
    defaultNotFoundComponent: () => <PantallaNoEncontrada />,
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
