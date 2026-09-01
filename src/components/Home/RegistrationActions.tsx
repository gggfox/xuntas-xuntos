import { Show } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'

/**
 * What to do while the window is open. Signed out it is register or sign in;
 * signed in there is nothing left to decide, so the only way forward is the
 * registration itself.
 */
export default function RegistrationActions() {
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
        <Link to="/mi-registro" className="btn no-underline">
          {m.nav_my_registration()}
        </Link>
      </Show>
    </div>
  )
}
