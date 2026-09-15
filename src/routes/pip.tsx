import { Show } from '@clerk/tanstack-react-start'
import { Navigate, createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import PipFeed from '../components/Pip/PipFeed'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'
import { SignedOut } from './perfil'

/**
 * The member's PIP. `?publicacion=` is the post a notification pointed
 * at: it opens at the top of the feed. A non-member who is not a lead is
 * sent to their registration, the page that says where they stand.
 */
export const Route = createFileRoute('/pip')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.nav_pip() }) }] }),
  validateSearch: (s: Record<string, unknown>): { publicacion?: string } =>
    typeof s.publicacion === 'string' && /^[a-z0-9]{10,64}$/i.test(s.publicacion) ? { publicacion: s.publicacion } : {},
  component: PipPage,
})

function PipPage() {
  return (
    <>
      <Show when="signed-out">
        <SignedOut />
      </Show>
      <Show when="signed-in">
        <Pip />
      </Show>
    </>
  )
}

function Pip() {
  const { publicacion } = Route.useSearch()
  const me = useMe()
  if (me === undefined) {
    return (
      <main className="col pt-[38px] pb-[90px]">
        <p className="text-soft">{m.common_loading()}</p>
      </main>
    )
  }
  if (me === null || !(me.member || can(me.roles, 'publish_pip'))) return <Navigate to="/mi-registro" replace />
  return (
    <main className="col col-720 pt-[38px] pb-[90px] lg:max-w-[880px]">
      <p className="eyebrow">{m.pip_eyebrow()}</p>
      <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">{m.pip_title()}</h1>
      <p className="mt-2 max-w-[62ch] font-light text-soft">{m.pip_intro()}</p>
      <PipFeed focusPostId={publicacion} />
    </main>
  )
}
