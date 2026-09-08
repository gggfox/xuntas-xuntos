import { Show } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import { useMe } from '../../hooks/useMe'
import { isAthlete } from '../../lib/permissions'

/**
 * What to do while the window is open. Signed out it is register or sign in;
 * signed in as an athlete there is nothing left to decide, so the only way
 * forward is the registration itself. An account that is only staff has no
 * registration, so it gets nothing here — administration is in the header.
 */
export default function RegistrationActions() {
  const me = useMe()
  const athlete = !!me && isAthlete(me.roles)

  return (
    <div className="mt-9 flex flex-wrap items-center gap-3">
      <Show when="signed-out">
        <Link to="/empezar" className="btn no-underline">
          {m.reg_title()}
        </Link>
        <Link to="/entrar" className="btn btn-ghost no-underline">
          {m.nav_sign_in()}
        </Link>
      </Show>
      <Show when="signed-in">
        {athlete && (
          <Link to="/mi-registro" className="btn no-underline">
            {m.nav_my_registration()}
          </Link>
        )}
      </Show>
    </div>
  )
}
