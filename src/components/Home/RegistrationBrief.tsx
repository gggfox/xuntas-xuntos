import * as m from '../../paraglide/messages.js'

/** The yellow note: the call for applications in a paragraph, before anyone clicks. */
export default function RegistrationBrief() {
  return (
    <section className="nota mt-7">
      <b className="mb-1.5 block font-disp text-[14.5px]">{m.reg_brief_title()}</b>
      <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">{m.reg_brief_text()}</p>
    </section>
  )
}
