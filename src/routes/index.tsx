import { Show } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { OPENS_AT_MS, isWindowOpen } from '../lib/cycle'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const isOpen = isWindowOpen()

  return (
    <main className="mx-auto max-w-[900px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.reg_eyebrow()}</p>
      <h1 className="h-display mt-[7px] max-w-[18ch] text-[clamp(30px,5.4vw,46px)]">
        {m.reg_title()}
      </h1>
      <p className="mt-4 max-w-[58ch] font-light text-soft">{m.reg_lede()}</p>

      <section className="nota mt-7 max-w-[62ch]">
        <b className="mb-1.5 block font-disp text-[14.5px]">{m.reg_brief_title()}</b>
        <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
          {m.reg_brief_text()}
        </p>
      </section>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        {isOpen ? (
          <>
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
          </>
        ) : (
          <div className="card px-[21px] py-[19px]">
            <b className="mb-1 block font-disp text-[15px]">
              {Date.now() < OPENS_AT_MS ? m.account_closed_title() : m.reg_closed()}
            </b>
            {Date.now() < OPENS_AT_MS && (
              <p className="m-0 text-[13px] font-light text-soft">{m.account_closed_text()}</p>
            )}
          </div>
        )}
      </div>

      <p className="eyebrow mt-8">{m.reg_closing()}</p>
    </main>
  )
}
