import { Navigate, createFileRoute } from '@tanstack/react-router'
import { canSeeAthletes } from '../components/Admin/AdminShell'
import NoTools from '../components/Admin/NoTools'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'

export const Route = createFileRoute('/administracion/')({
  component: AdminIndex,
})

/**
 * Where /administracion lands: the registrations table for reviewers, the
 * athletes for a coach or a health specialist, the staff page for anyone
 * who may only see that, and the placeholder for a role with no screens.
 */
function AdminIndex() {
  const me = useMe()
  if (!me) return null
  if (can(me.roles, 'review_registrations')) return <Navigate to="/administracion/registros" replace />
  if (canSeeAthletes(me.roles)) return <Navigate to="/administracion/atletas" replace />
  if (can(me.roles, 'view_staff')) return <Navigate to="/administracion/equipo" replace />
  return <NoTools />
}
