import { Show } from '@clerk/tanstack-react-start'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import RegistrationPanel from '../components/MyRegistration/RegistrationPanel'

/**
 * `?paso=N` is the reader's place in the form, one-based to match the section
 * numbers they can see. It lives in the URL rather than in a row so the back
 * button works and a reload lands where they were, and because there is
 * nothing to store: the step is a view of the draft, and the draft is already
 * saved. Nothing here trusts the number — the form clamps it to the first
 * step still unfilled, so a hand-typed `?paso=8` does not skip the form.
 */
export const Route = createFileRoute('/mi-registro')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.nav_my_registration() }) }] }),
  validateSearch: (search: Record<string, unknown>): { paso?: number } => {
    const raw = Number(search.paso)
    return Number.isFinite(raw) ? { paso: Math.trunc(raw) } : {}
  },
  component: MyRegistration,
})

function MyRegistration() {
  const { paso } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

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
        <RegistrationPanel
          step={paso === undefined ? undefined : paso - 1}
          onStepChange={(step) => {
            void navigate({
              search: { paso: step + 1 },
              // The reader moving through the form is one visit, not eight.
              // Without this, leaving the page means eight presses of Back.
              replace: true,
            })
          }}
        />
      </Show>
    </>
  )
}
