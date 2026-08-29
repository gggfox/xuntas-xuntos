import { Show, SignOutButton } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'

/**
 * The right half of the header: everything that depends on the session.
 *
 * Signed in there is one place to go — the registration itself — and one way
 * out. Signed out there is only the way in; registering is offered on the
 * home page, not here, so the header never competes with the page's own call
 * to action.
 */
export default function AccountNav() {
  return (
    <nav className="flex items-center gap-4 text-[13px]">
      <Show when="signed-in">
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
    </nav>
  )
}
