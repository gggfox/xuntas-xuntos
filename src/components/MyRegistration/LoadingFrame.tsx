import * as m from '../../paraglide/messages.js'
import { REVIEW_DATE } from '../../lib/cycle'

type Props = {
  children: React.ReactNode
}

/**
 * The waiting screen while Convex answers. It carries the review date so the
 * page says something useful even before it knows what to show.
 */
export default function LoadingFrame({ children }: Props) {
  return (
    <main className="col pt-[46px] pb-[90px]">
      <p className="text-soft">{children}</p>
      <p className="eyebrow mt-4">
        {m.done_review()} · {REVIEW_DATE}
      </p>
    </main>
  )
}
