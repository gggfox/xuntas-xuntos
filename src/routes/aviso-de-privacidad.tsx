import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { DOCUMENTS } from '../lib/documents'

export const Route = createFileRoute('/aviso-de-privacidad')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.privacy_title() }) }] }),
  component: PrivacyNotice,
})

/**
 * Privacy notice — LFPDPPP.
 *
 * The text has to come from XUNTAS: it is a legal document and you don't
 * improvise one from code. What lives here is the SCAFFOLD, with the sections
 * the law asks for, so they only need to be filled in.
 *
 * While `DOCUMENTS.privacyNotice.ready` is `false`, the page is shown with a
 * visible warning that it is not the final document. That is on purpose: a
 * page that looks like a privacy notice but isn't one would be worse than not
 * having any.
 */
function PrivacyNotice() {
  return (
    <main className="col col-720 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.brand_cycle()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">
        {m.privacy_title()}
      </h1>

      {!DOCUMENTS.privacyNotice.ready && (
        <section className="nota mt-7 border-bad/40 bg-bad/5">
          <b className="mb-1.5 block font-disp text-[14.5px]">{m.doc_draft_title()}</b>
          <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
            {m.doc_draft_text()}
          </p>
        </section>
      )}

      <div className="prose prose-sm mt-8 max-w-none font-light text-soft">
        <h2 className="h-display mt-8 text-[18px] text-ink">1. Quién es responsable de tus datos</h2>
        <p>
          <i>Pendiente: razón social completa de XUNTAS+XUNTOS, domicilio fiscal y
          correo de contacto para asuntos de datos personales.</i>
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">2. Qué datos recabamos</h2>
        <p>
          Los que se capturan en este registro: nombre, fecha de nacimiento, correo
          electrónico, número de contacto, ciudad y estado de residencia, escuela y
          grado, club, coach, índice GHIN, resultados deportivos, rankings,
          calendario de torneos y la carta de motivos. De las personas menores de
          edad, además, el nombre y correo de su padre, madre o tutor.
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">3. Para qué los usamos</h2>
        <p>
          Para evaluar la solicitud, dar seguimiento al Programa de Desarrollo y
          reportar sus resultados. <i>Pendiente: confirmar si hay finalidades
          secundarias (difusión, fotografía, patrocinadores) y cómo se puede
          negar el consentimiento a cada una por separado.</i>
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">4. Personas menores de edad</h2>
        <p>
          El registro de una persona menor de edad requiere la autorización de su
          padre, madre o tutor, que se recaba por correo electrónico antes de
          completar la cuenta. La casilla que marca la persona registrante no
          sustituye esa autorización.
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">5. Con quién se comparten</h2>
        <p>
          <i>Pendiente: nombrar a los encargados que tratan los datos por cuenta de
          XUNTAS —incluido el proveedor de la base de datos, que los aloja fuera de
          México— y si hay transferencias que requieran consentimiento.</i>
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">
          6. Derechos ARCO y revocación
        </h2>
        <p>
          <i>Pendiente: correo y procedimiento para ejercer acceso, rectificación,
          cancelación y oposición, y para revocar el consentimiento.</i>
        </p>

        <h2 className="h-display mt-8 text-[18px] text-ink">7. Cambios a este aviso</h2>
        <p>
          <i>Pendiente: cómo se comunican los cambios.</i>
        </p>
      </div>
    </main>
  )
}
