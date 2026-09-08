import * as m from '../paraglide/messages.js'
import { Bone, Loading } from './Skeleton'

type Props = {
  /** The reading column's width; the default is BRAND.md's 900. */
  width?: '560' | '900'
  /** The review date, already in the page's locale. Absent, nothing renders on that line. */
  reviewOnText?: string
}

/**
 * The waiting screen for a whole page: the heading pattern from BRAND.md —
 * eyebrow, display title, a short paragraph — as bars, in the column the
 * page will use. It replaces `LoadingFrame` wherever the wait is for data;
 * `LoadingFrame` stays for the one wait that is a message (an account
 * still syncing), because that sentence is for the reader, not a
 * placeholder.
 *
 * Like `LoadingFrame` it can carry the review date, so `/mi-registro` says
 * something useful even before it knows what to show.
 */
export default function PageSkeleton({ width = '900', reviewOnText }: Props) {
  return (
    <main className={`col ${width === '560' ? 'col-560' : ''} pt-[46px] pb-[90px]`}>
      <Loading>
        <Bone className="h-[10px] w-[120px]" />
        <Bone className="mt-3 h-[30px] w-[min(360px,70%)]" />
        <Bone className="mt-5 h-3 w-[min(520px,100%)]" />
        <Bone className="mt-2.5 h-3 w-[min(440px,84%)]" />
        <Bone className="mt-2.5 h-3 w-[min(300px,58%)]" />
      </Loading>
      {reviewOnText && <p className="eyebrow mt-4">{m.done_review({ date: reviewOnText })}</p>}
    </main>
  )
}
