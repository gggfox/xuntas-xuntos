import { Show } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { APERTURA_MS, ventanaAbierta } from '../lib/ciclo'

export const Route = createFileRoute('/')({
  component: Portada,
})

function Portada() {
  const abierta = ventanaAbierta()

  return (
    <main className="mx-auto max-w-[900px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.reg_eyebrow()}</p>
      <h1 className="h-display mt-[7px] max-w-[18ch] text-[clamp(30px,5.4vw,46px)]">
        {m.reg_titulo()}
      </h1>
      <p className="mt-4 max-w-[58ch] font-light text-soft">{m.reg_lede()}</p>

      <section className="nota mt-7 max-w-[62ch]">
        <b className="mb-1.5 block font-disp text-[14.5px]">{m.reg_breve_titulo()}</b>
        <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
          {m.reg_breve_texto()}
        </p>
      </section>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        {abierta ? (
          <>
            <Show when="signed-out">
              <Link to="/empezar" className="btn no-underline">
                {m.reg_titulo()}
              </Link>
              <Link to="/entrar" className="btn btn-ghost no-underline">
                {m.nav_entrar()}
              </Link>
            </Show>
            <Show when="signed-in">
              <Link to="/mi-registro" className="btn no-underline">
                {m.nav_mi_registro()}
              </Link>
            </Show>
          </>
        ) : (
          <div className="card px-[21px] py-[19px]">
            <b className="mb-1 block font-disp text-[15px]">
              {Date.now() < APERTURA_MS ? m.cuenta_cerrada_titulo() : m.reg_cerrado()}
            </b>
            {Date.now() < APERTURA_MS && (
              <p className="m-0 text-[13px] font-light text-soft">{m.cuenta_cerrada_texto()}</p>
            )}
          </div>
        )}
      </div>

      <p className="eyebrow mt-8">{m.reg_cierre()}</p>
    </main>
  )
}
