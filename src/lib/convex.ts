import { ConvexReactClient } from 'convex/react'

const url = import.meta.env.VITE_CONVEX_URL as string | undefined

if (!url) {
  throw new Error(
    'Missing VITE_CONVEX_URL. Run `npx convex dev` and copy the URL to .env.local (see .env.example).',
  )
}

/**
 * The single Convex client.
 *
 * The registration screens all sit behind a session, so data is requested
 * from the client with the `convex/react` hooks. There is no data SSR: none
 * of this gets indexed or shared by link.
 */
export const convex = new ConvexReactClient(url)
