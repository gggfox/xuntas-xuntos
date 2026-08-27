import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { DOCUMENTOS } from '../lib/documentos'
import { FECHA_REVISION } from '../lib/ciclo'

export const Route = createFileRoute('/bases')({
  component: Bases,
})

/**
 * Bases de la convocatoria. Mismo trato que el aviso de privacidad: el texto lo
 * entrega XUNTAS y aquí solo está el andamio. La casilla `ck1` del formulario
 * enlaza a esta página, y aceptar unas bases que no se pueden leer no es
 * aceptar nada.
 */
function Bases() {
  return (
    <main className="mx-auto max-w-[720px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.marca_ciclo()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.bases_titulo()}</h1>

      {!DOCUMENTOS.bases.listo && (
        <section className="nota mt-7 border-bad/40 bg-bad/5">
          <b className="mb-1.5 block font-disp text-[14.5px]">{m.doc_borrador_titulo()}</b>
          <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
            {m.doc_borrador_texto()}
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
          {FECHA_REVISION}.
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
