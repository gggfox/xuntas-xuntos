import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Which call the admin pages look at. Lives in the URL (`?ciclo=`) so a link
 * to last year's table opens last year's table; defaults to the active one.
 */
export function useAdminCycle() {
  const { ciclo } = useSearch({ from: '/administracion' })
  const navigate = useNavigate({ from: '/administracion' })
  const cycles = useQuery(api.cycles.list)
  const cycle = ciclo ?? cycles?.find((c) => c.isActive)?.cycle
  return {
    cycle,
    cycles,
    setCycle: (c: string) => void navigate({ search: { ciclo: c }, replace: true }),
  }
}
