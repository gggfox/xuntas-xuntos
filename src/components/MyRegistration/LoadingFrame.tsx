import * as m from '../../paraglide/messages.js'

type Props = {
  children: React.ReactNode
  /** The review date, already in the page's locale. Absent, nothing renders on that line. */
  reviewOnText?: string
}

/**
 * The waiting screen while Convex answers. It carries the review date so the
 * page says something useful even before it knows what to show.
 */
export default function LoadingFrame({ children, reviewOnText }: Props) {
  return (
    <main className="col pt-[46px] pb-[90px]">
      <p className="text-soft">{children}</p>
      {reviewOnText && <p className="eyebrow mt-4">{m.done_review({ date: reviewOnText })}</p>}
    </main>
  )
}
