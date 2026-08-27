import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { createMiddleware, createStart } from '@tanstack/react-start'
import { paraglideMiddleware } from './paraglide/server.js'

/**
 * Resuelve el idioma de cada petición y lo deja en el AsyncLocalStorage de
 * Paraglide, para que dos peticiones concurrentes en idiomas distintos no se
 * pisen durante el SSR.
 *
 * A propósito se le pasa la petición ORIGINAL (con su prefijo `/es`) y no la
 * de-localizada: quien quita y pone el prefijo es la opción `rewrite` del
 * router (ver src/router.tsx). Si lo hicieran los dos, se ciclan los redirects.
 */
const paraglide = createMiddleware({ type: 'request' }).server(({ next, request }) =>
  paraglideMiddleware(request, () => next()),
)

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [paraglide, clerkMiddleware()],
  }
})
