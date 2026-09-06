import * as m from '../../paraglide/messages.js'

type Props = {
  /** The window has not opened yet, as opposed to having already closed. */
  beforeOpening: boolean
  /** The call's title, already resolved by `useActiveCycle`. */
  title: string
  /** The opening and closing dates, already in the page's locale. */
  opensOnText: string
  closesOnText: string
}

/**
 * Stands where the buttons would be when there is nothing to click. Two
 * silences read the same on screen but not to the reader: before the window
 * opens there is a date to wait for, after it closes there is not.
 *
 * A block, not a shrink-to-fit box inside the button row: the closed notice
 * reads as a sibling of the yellow one above it and has to share its edges.
 */
export default function RegistrationClosedNotice({
  beforeOpening,
  title,
  opensOnText,
  closesOnText,
}: Props) {
  return (
    <div className="card mt-9 px-[21px] py-[19px]">
      <b className="mb-1 block font-disp text-[15px]">
        {beforeOpening ? m.account_closed_title() : m.reg_closed({ date: closesOnText })}
      </b>
      {beforeOpening && (
        <p className="m-0 text-[13px] font-light text-soft">
          {m.account_closed_text({ title, date: opensOnText })}
        </p>
      )}
    </div>
  )
}
