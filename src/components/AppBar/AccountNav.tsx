import { Show, SignOutButton } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import { useMe } from '../../hooks/useMe'
import { isStaff } from '../../lib/permissions'
import NavMenu from './NavMenu'
import ThemeToggle from './ThemeToggle'

/**
 * The right half of the header: everything that depends on the session.
 *
 * Signed in there is one place to go — the registration itself — and one way
 * out. Signed out there is only the way in; registering is offered on the
 * home page, not here, so the header never competes with the page's own call
 * to action.
 *
 * The links are built once and mounted twice: in a row on screens wide
 * enough to hold it, and inside `NavMenu` on the ones that are not. Two
 * mount points, one list — a link added below is added to both, and the
 * narrow bar cannot drift into offering something different from the wide
 * one. Only one of them is ever in the page: the row is `display: none`
 * under `md`, which takes it out of the accessibility tree too, so nothing
 * is announced twice.
 *
 * The theme toggle stays out in the bar at every width. It is one tap, it
 * reads as an icon, and burying a control that changes the whole page
 * behind a menu makes it cost two.
 */
export default function AccountNav() {
  const me = useMe()
  const links = (
    <>
      <Show when="signed-in">
        {me && isStaff(me.roles) && (
          <Link to="/administracion" className="text-white/72 no-underline hover:text-white">
            {m.nav_admin()}
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
      </Show>
      <Show when="signed-out">
        <Link to="/entrar" className="text-white/72 no-underline hover:text-white">
          {m.nav_sign_in()}
        </Link>
      </Show>
    </>
  )

  return (
    <nav className="flex items-center gap-3 text-[13px] md:gap-4">
      <ThemeToggle />
      <span className="hidden items-center gap-4 md:flex">{links}</span>
      <NavMenu>{links}</NavMenu>
    </nav>
  )
}
