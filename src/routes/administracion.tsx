import { Show } from '@clerk/tanstack-react-start'
import { Link, Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import AdminShell from '../components/Admin/AdminShell'
import LoadingFrame from '../components/MyRegistration/LoadingFrame'
import { useMe } from '../hooks/useMe'
import { isStaff } from '../lib/permissions'

export const Route = createFileRoute('/administracion')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.admin_title() }) }] }),
  // Which call the admin pages look at. A bare cycle name only — anything
  // else in `?ciclo=` is dropped rather than trusted.
  validateSearch: (search: Record<string, unknown>): { ciclo?: string } =>
    typeof search.ciclo === 'string' && /^\d{4}-\d{4}$/.test(search.ciclo) ? { ciclo: search.ciclo } : {},
  component: AdminLayout,
})

/**
 * Everything under /administracion. The child routes decide what a given
 * permission may see; this only decides that there is a signed-in account
 * with a Convex row, and draws the frame around whatever the child renders.
 */
function AdminLayout() {
  return (
    <>
      <Show when="signed-out">
        <main className="col col-560 pt-[46px] pb-[90px]">
          <h1 className="h-display text-[clamp(26px,4.6vw,36px)]">{m.nav_sign_in()}</h1>
          <p className="mt-3 font-light text-soft">{m.admin_signed_out()}</p>
          <Link to="/entrar" className="btn mt-6 inline-block no-underline">
            {m.nav_sign_in()}
          </Link>
        </main>
      </Show>
      <Show when="signed-in">
        <SignedIn />
      </Show>
    </>
  )
}

function SignedIn() {
  const me = useMe()
  if (me === undefined) return <LoadingFrame>{m.common_loading()}</LoadingFrame>
  if (me === null) return <LoadingFrame>{m.sync_text()}</LoadingFrame>
  // Athletes have no admin tools. Symmetric with RegistrationPanel sending
  // staff back here: each side sends the other to its own panel.
  if (!isStaff(me.roles)) return <Navigate to="/mi-registro" replace />
  return (
    <AdminShell roles={me.roles}>
      <Outlet />
    </AdminShell>
  )
}
