import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import RegistrationSections from './RegistrationSections'
import { useFillHeight } from '../../hooks/useFillHeight'

export type Detail = FunctionReturnType<typeof api.registrations.detail>

/**
 * The admin's record of one registration. The sections themselves live in
 * `RegistrationSections`, shared with the athlete's profile and the staff
 * view; this is the one that takes the whole `detail` payload.
 *
 * The page opens on section 1 rather than on a summary of the account. The
 * card that used to stand here repeated the address and the date of birth
 * that section 1 gives in full a screen-height below, and a long address had
 * nowhere to go in a third of a card.
 */
export default function RegistrationDetail({ detail }: { detail: Detail }) {
  const card = useFillHeight<HTMLDivElement>()
  return (
    // One card for the whole record, the height of the window from `lg`
    // (`tall-*`, styles.css) so the eight sections scroll beside a decision
    // panel that stays put.
    <div ref={card} className="card tall-card">
      <div className="tall-scroll px-[21px] py-[19px]">
        <RegistrationSections registration={detail.registration} />
      </div>
    </div>
  )
}
