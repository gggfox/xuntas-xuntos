import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

/**
 * Which call the admin pages look at. Lives in the URL (`?ciclo=`) so a link
 * to last year's table opens last year's table; defaults to the active one.
 *
 * `?ciclo=` only ever carries an opaque, loosely-shape-checked id string —
 * `administracion.tsx`'s `validateSearch` is what stands between this and
 * whatever a URL bar actually contains. The cast below is why that check
 * exists: the server (`ctx.db.get`) is the real gate against a malformed id.
 */
export function useAdminCycle() {
  const { ciclo } = useSearch({ from: '/administracion' })
  const navigate = useNavigate({ from: '/administracion' })
  const cycles = useQuery(api.cycles.list)
  const cycle = (ciclo as Id<'cycles'> | undefined) ?? cycles?.find((c) => c.isActive)?._id
  return {
    cycle,
    cycles,
    setCycle: (c: Id<'cycles'>) => void navigate({ search: { ciclo: c }, replace: true }),
  }
}
