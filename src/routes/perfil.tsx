import { Show } from '@clerk/tanstack-react-start'
import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import RegistrationSections from '../components/Admin/RegistrationSections'
import TeamCard from '../components/Journal/TeamCard'

/**
 * A member's own record: the registration the Consejo Técnico selected
 * them on, read-only, and the team assigned to them. Nobody else lands
 * here — a non-member is sent to their registration, which is the page
 * that says where they stand.
 */
export const Route = createFileRoute('/perfil')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.nav_profile() }) }] }),
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <>
      <Show when="signed-out">
        <SignedOut />
      </Show>
      <Show when="signed-in">
        <Profile />
      </Show>
    </>
  )
}

/** The same wall `mi-registro` puts up: a title and the way in. */
export function SignedOut() {
  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <h1 className="h-display text-[clamp(26px,4.6vw,36px)]">{m.nav_sign_in()}</h1>
      <p className="mt-3 font-light text-soft">{m.account_no_password()}</p>
      <Link to="/entrar" className="btn mt-6 inline-block no-underline">
        {m.nav_sign_in()}
      </Link>
    </main>
  )
}

function Profile() {
  const profile = useQuery(api.members.myProfile)
  const team = useQuery(api.assignments.myTeam)

  if (profile === undefined) {
    return (
      <main className="col pt-[38px] pb-[90px]">
        <p className="text-soft">{m.common_loading()}</p>
      </main>
    )
  }
  if (profile === null) return <Navigate to="/mi-registro" replace />

  const r = profile.registration
  return (
    <main className="col max-w-[1240px] pt-[38px] pb-[90px]">
      <p className="eyebrow">{m.perfil_eyebrow({ title: profile.cycleTitle })}</p>
      <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">{r.personal.name}</h1>
      <p className="mt-2 max-w-[62ch] font-light text-soft">{m.perfil_intro()}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <RegistrationSections registration={r} />
        <div className="grid content-start gap-4">
          <TeamCard team={team ?? undefined} />
          <Link to="/bitacora" className="btn btn-ghost justify-self-start no-underline">
            {m.nav_journal()}
          </Link>
        </div>
      </div>
    </main>
  )
}
