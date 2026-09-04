import * as m from '../../paraglide/messages.js'

type Props = {
  /** The call's title, already resolved by `useActiveCycle`. */
  title: string
  /**
   * Whether `title` is real. Kept separate from the string itself so the
   * component never has to guess "empty" apart from "not loaded yet" —
   * `title` stays a plain required string, and this is the one thing that
   * decides whether the eyebrow above the heading renders at all.
   */
  titleReady: boolean
}

/**
 * The three lines that open the page: what this is, what it is called, and
 * what it is for. The title caps at 18ch so it breaks into two lines on a
 * phone instead of one long thin one.
 *
 * Only the eyebrow depends on the cycle — the heading and the lede below it
 * are static copy and appear immediately, whether or not `titleReady` is true.
 */
export default function RegistrationLede({ title, titleReady }: Props) {
  return (
    <>
      {titleReady && <p className="eyebrow">{m.reg_eyebrow({ title })}</p>}
      <h1 className="h-display mt-[7px] max-w-[18ch] text-[clamp(30px,5.4vw,46px)]">
        {m.reg_title()}
      </h1>
      <p className="mt-4 font-light text-soft">{m.reg_lede()}</p>
    </>
  )
}
