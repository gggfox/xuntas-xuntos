import * as m from '../../paraglide/messages.js'

/**
 * The three lines that open the page: what this is, what it is called, and
 * what it is for. The title caps at 18ch so it breaks into two lines on a
 * phone instead of one long thin one.
 */
export default function RegistrationLede() {
  return (
    <>
      <p className="eyebrow">{m.reg_eyebrow()}</p>
      <h1 className="h-display mt-[7px] max-w-[18ch] text-[clamp(30px,5.4vw,46px)]">
        {m.reg_title()}
      </h1>
      <p className="mt-4 font-light text-soft">{m.reg_lede()}</p>
    </>
  )
}
