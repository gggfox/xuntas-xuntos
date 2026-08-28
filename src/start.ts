import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { createMiddleware, createStart } from '@tanstack/react-start'
import { paraglideMiddleware } from './paraglide/server.js'

/**
 * Resolves each request's language and leaves it in Paraglide's
 * AsyncLocalStorage, so that two concurrent requests in different languages
 * don't trample each other during SSR.
 *
 * On purpose it gets the ORIGINAL request (with its `/es` prefix), not the
 * de-localized one: stripping and re-adding the prefix is the job of the
 * router's `rewrite` option (see src/router.tsx). If both did it, the
 * redirects would loop.
 */
const paraglide = createMiddleware({ type: 'request' }).server(({ next, request }) =>
  paraglideMiddleware(request, () => next()),
)

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [paraglide, clerkMiddleware()],
  }
})
