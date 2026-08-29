import { Show } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import RegistrationPanel from '../components/MyRegistration/RegistrationPanel'

export const Route = createFileRoute('/mi-registro')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.nav_my_registration() }) }] }),
  component: MyRegistration,
})

function MyRegistration() {
  return (
    <>
      <Show when="signed-out">
        <main className="col col-560 pt-[46px] pb-[90px]">
          <h1 className="h-display text-[clamp(26px,4.6vw,36px)]">{m.nav_sign_in()}</h1>
          <p className="mt-3 font-light text-soft">{m.account_no_password()}</p>
          <Link to="/entrar" className="btn mt-6 inline-block no-underline">
            {m.nav_sign_in()}
          </Link>
        </main>
      </Show>
      <Show when="signed-in">
        <RegistrationPanel />
      </Show>
    </>
  )
}
