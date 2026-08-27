import { ConvexReactClient } from 'convex/react'

const url = import.meta.env.VITE_CONVEX_URL as string | undefined

if (!url) {
  throw new Error(
    'Falta VITE_CONVEX_URL. Corre `npx convex dev` y copia la URL a .env.local (ver .env.example).',
  )
}

/**
 * Cliente único de Convex.
 *
 * Las pantallas de registro van todas detrás de sesión, así que los datos se
 * piden desde el cliente con los hooks de `convex/react`. No hay SSR de datos:
 * nada de esto se indexa ni se comparte por enlace.
 */
export const convex = new ConvexReactClient(url)
