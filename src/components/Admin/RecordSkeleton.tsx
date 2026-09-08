import { useFillHeight } from '../../hooks/useFillHeight'
import { Bone, Loading } from '../Skeleton'

/** One numbered section's worth of fields, two to a row, as `RegistrationDetail` draws them. */
function Section({ fields }: { fields: number }) {
  return (
    <div className="mb-[30px] last:mb-0">
      <Bone className="mb-[13px] h-[15px] w-[240px]" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i}>
            <Bone className="h-[9px] w-[88px]" />
            <Bone className="mt-2 h-3 w-[64%]" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A record before it arrives: the title, the card of sections at the
 * window's height (the same `useFillHeight` the real one uses), and the
 * decision panel beside it — eyebrow, two chips, the note, two buttons.
 * The back link is not here; it is real, in the route, because it does
 * not wait on anything.
 */
export default function RecordSkeleton() {
  const card = useFillHeight<HTMLDivElement>()
  return (
    <Loading>
      <Bone className="mt-4 h-[30px] w-[min(320px,60%)]" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]" aria-hidden="true">
        <div ref={card} className="card tall-card">
          <div className="tall-scroll px-[21px] py-[19px]">
            <Section fields={7} />
            <Section fields={4} />
            <Section fields={4} />
          </div>
        </div>
        <div className="card px-[21px] py-[19px] lg:self-start">
          <Bone className="h-[9px] w-[64px]" />
          <div className="mt-3 flex gap-2">
            <Bone className="h-[21px] w-[110px] rounded-full" />
            <Bone className="h-[21px] w-[80px] rounded-full" />
          </div>
          <Bone className="mt-6 h-3 w-[90px]" />
          <Bone className="mt-2 h-[80px] w-full rounded-ctl" />
          <div className="mt-6 flex gap-2">
            <Bone className="h-[34px] w-[84px] rounded-[7px]" />
            <Bone className="h-[34px] w-[84px] rounded-[7px]" />
          </div>
        </div>
      </div>
    </Loading>
  )
}
