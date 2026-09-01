import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { DOCUMENTS } from '../lib/documents'
import { REVIEW_DATE } from '../lib/cycle'

export const Route = createFileRoute('/bases')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.rules_title() }) }] }),
  component: Rules,
})

/**
 * Rules of the call for applications. Same deal as the privacy notice: the
 * text comes from XUNTAS and only the scaffold lives here. The form's `ck1`
 * checkbox links to this page, and accepting rules you cannot read is not
 * accepting anything.
 */
function Rules() {
  return (
    <main className="col col-720 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.brand_cycle()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.rules_title()}</h1>

      {!DOCUMENTS.rules.ready && (
        <section className="nota mt-7 border-bad/40 bg-bad/5">
          <b className="mb-1.5 block font-disp text-[14.5px]">{m.doc_draft_title()}</b>
          <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
            {m.doc_draft_text()}
          </p>
        </section>
      )}

      <div className="mt-8 max-w-none font-light text-soft">
        <h2 className="h-display mt-8 text-[18px] text-ink">Quién puede registrarse</h2>
        <p>
          <i>Pendiente: requisitos de edad, rama, nacionalidad o residencia, e índice
          GHIN mínimo si aplica.</i>
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">Fechas</h2>
        <p>
          El registro abre el 4 de septiembre y cierra el 18 de septiembre de 2026 a
          las 23:59, hora del centro de México. Las solicitudes se revisan antes del{' '}
          {REVIEW_DATE}.
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">Cómo se evalúa</h2>
        <p>
          <i>Pendiente: criterios del Consejo Técnico y su peso relativo.</i>
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">Sobre la beca</h2>
        <p>
          El registro no garantiza la admisión al programa ni la obtención de una
          beca. Las resoluciones del Consejo Técnico son definitivas.{' '}
          <i>Pendiente: qué cubre la beca, por cuánto tiempo y bajo qué condiciones
          se conserva.</i>
        </p>
      </div>
    </main>
  )
}
