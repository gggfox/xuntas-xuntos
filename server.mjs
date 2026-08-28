/**
 * Production entry point.
 *
 * `vite build` does NOT generate a server that listens on a port: it leaves a
 * web-style `fetch` handler in dist/server/server.js, and the static assets
 * in dist/client. Something has to join the two halves and open the socket.
 * In development Vite does it; here we do it with srvx, which is the same
 * library `vite preview` uses under the hood.
 *
 * Mind the order: static files go first, as middleware. If the request does
 * not match a file in dist/client, it falls through to the SSR handler.
 */
import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'

import handler from './dist/server/server.js'

const port = Number(process.env.PORT) || 3000

serve({
  port,
  // 0.0.0.0 and not localhost: inside the container nobody would reach the
  // server if it only listened on the loopback interface.
  hostname: '0.0.0.0',
  middleware: [serveStatic({ dir: './dist/client' })],
  fetch: handler.fetch,
})

console.log(`listening on http://0.0.0.0:${port}`)
