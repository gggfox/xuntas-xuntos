import { Show, SignOutButton, useUser } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import { useMe } from '../../hooks/useMe'
import { isStaff } from '../../lib/permissions'
import AccountMenu from './AccountMenu'
import NavMenu from './NavMenu'
import ThemeToggle from './ThemeToggle'

/**
 * The right half of the header: everything that depends on the session.
 *
 * Signed in, the bar shows who is signed in — an avatar — and, for staff,
 * the one place that is not theirs to reach any other way: administration.
 * The registration itself and the way out live behind the avatar, since
 * both belong to the account and neither needs to be in view all the time.
 * Signed out there is only the way in; registering is offered on the home
 * page, not here, so the header never competes with the page's own call to
 * action.
 *
 * The links are built once and mounted twice: on screens wide enough, split
 * between the bar and the avatar's panel; on the ones that are not, all of
 * them inside `NavMenu`, where a face in a bar that is already a burger
 * would be a second menu beside the first. Only one arrangement is ever in
 * the page — the wide one is `display: none` under `md`, which takes it out
 * of the accessibility tree too, so nothing is announced twice.
 *
 * The theme toggle stays out in the bar at every width. It is one tap, it
 * reads as an icon, and burying a control that changes the whole page
 * behind a menu makes it cost two.
 */
export default function AccountNav() {
  const me = useMe()
  const { user } = useUser()
  const staff = !!me && isStaff(me.roles)

  const adminLink = staff && (
    <Link to="/administracion" className="text-white/72 no-underline hover:text-white">
      {m.nav_admin()}
    </Link>
  )
  const member = !!me && me.member
  const accountLinks = (
    <>
      {/* A member's two pages come first: they are what the account is for now. */}
      {member && (
        <Link to="/perfil" className="text-white/72 no-underline hover:text-white">
          {m.nav_profile()}
        </Link>
      )}
      {member && (
        <Link to="/bitacora" className="text-white/72 no-underline hover:text-white">
          {m.nav_journal()}
        </Link>
      )}
      <Link to="/mi-registro" className="text-white/72 no-underline hover:text-white">
        {m.nav_my_registration()}
      </Link>
      <SignOutButton>
        <button className="font-mono text-[11.5px] tracking-[.06em] text-white/60 hover:text-white">
          {m.nav_sign_out()}
        </button>
      </SignOutButton>
    </>
  )
  const signInLink = (
    <Link to="/entrar" className="text-white/72 no-underline hover:text-white">
      {m.nav_sign_in()}
    </Link>
  )

  return (
    <nav className="flex items-center gap-3 text-[13px] md:gap-4">
      <ThemeToggle />
      <span className="hidden items-center gap-4 md:flex">
        <Show when="signed-in">
          {adminLink}
          <AccountMenu
            name={user?.fullName}
            email={user?.primaryEmailAddress?.emailAddress}
            imageUrl={user?.imageUrl}
          >
            {accountLinks}
          </AccountMenu>
        </Show>
        <Show when="signed-out">{signInLink}</Show>
      </span>
      <NavMenu>
        <Show when="signed-in">
          {adminLink}
          {accountLinks}
        </Show>
        <Show when="signed-out">{signInLink}</Show>
      </NavMenu>
    </nav>
  )
}
