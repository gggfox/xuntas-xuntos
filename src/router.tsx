import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { deLocalizeUrl, localizeUrl } from './paraglide/runtime.js'
import ErrorScreen from './components/ErrorScreen'
import NotFoundScreen from './components/NotFoundScreen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    /**
     * Without these two, a render error leaves the page blank and a mistyped
     * URL leaves the browser with a blank screen as well. In an app that gets
     * shared over WhatsApp, links often arrive cut off.
     */
    defaultErrorComponent: ({ error }) => <ErrorScreen error={error} />,
    defaultNotFoundComponent: () => <NotFoundScreen />,
    /**
     * Language prefix in the URL.
     *
     * `input` strips the prefix before matching routes, so the files in
     * src/routes are written without `/es`. `output` puts it back when
     * generating links, so that whatever gets shared over WhatsApp opens in
     * the language it was shared in.
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
