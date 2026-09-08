import type { Id } from '../../../convex/_generated/dataModel'
import * as m from '../../paraglide/messages.js'
import CommentThread from './CommentThread'

/**
 * The words the team leaves about the athlete's process as a whole, not
 * under any one entry. Sits above the feed: the first thing a coach reads
 * on a member who has not written yet, and the place to write when there
 * is nothing yet to write under.
 */
export default function GeneralStream({ athleteUserId, composerPrimary }: { athleteUserId: Id<'users'>; composerPrimary?: boolean }) {
  return (
    <section className="card px-[21px] py-[19px]">
      <p className="eyebrow">{m.journal_general_title()}</p>
      <p className="mt-1 mb-3 text-[12.5px] font-light text-soft">{m.journal_general_help()}</p>
      <CommentThread athleteUserId={athleteUserId} composerPrimary={composerPrimary} />
    </section>
  )
}
