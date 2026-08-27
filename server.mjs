/**
 * Entrada de producción.
 *
 * `vite build` NO genera un servidor que escuche un puerto: deja en
 * dist/server/server.js un handler `fetch` al estilo web, y en dist/client los
 * assets estáticos. Algo tiene que unir las dos mitades y abrir el socket.
 * En desarrollo lo hace Vite; aquí lo hacemos con srvx, que es la misma
 * librería que usa `vite preview` por dentro.
 *
 * Ojo con el orden: los estáticos van primero como middleware. Si la petición
 * no corresponde a un archivo de dist/client, cae al handler de SSR.
 */
import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'

import handler from './dist/server/server.js'

const port = Number(process.env.PORT) || 3000

serve({
  port,
  // 0.0.0.0 y no localhost: dentro del contenedor nadie llegaría al servidor
  // si solo escuchara en la interfaz de loopback.
  hostname: '0.0.0.0',
  middleware: [serveStatic({ dir: './dist/client' })],
  fetch: handler.fetch,
})

console.log(`listening on http://0.0.0.0:${port}`)
