import { useFillHeight } from '../../hooks/useFillHeight'
import { Bone, Loading } from '../Skeleton'

/**
 * What a cell will hold, so the bar is the shape of it: a checkbox, a name,
 * a chip, a `7/7`, a date, an *Abrir* button.
 */
export type ColumnShape = 'check' | 'text' | 'chip' | 'mono' | 'date' | 'button'

/** The card is drawn at the window's height, so twelve rows fill a laptop; the rest is clipped. */
const ROWS = 12

/** A name is not the same width on every row; three widths, cycling, read as names. */
const TEXT_WIDTHS = ['w-[72%]', 'w-[54%]', 'w-[86%]']

const HEAD: Record<ColumnShape, string> = {
  check: 'size-[13px] rounded-[3px]',
  text: 'h-[9px] w-[52px]',
  chip: 'h-[9px] w-[44px]',
  mono: 'h-[9px] w-[60px]',
  date: 'h-[9px] w-[56px]',
  button: 'h-[9px] w-0',
}

function Cell({ shape, row }: { shape: ColumnShape; row: number }) {
  switch (shape) {
    case 'check':
      return <Bone className="size-[13px] rounded-[3px]" />
    case 'text':
      return <Bone className={`h-3 ${TEXT_WIDTHS[row % TEXT_WIDTHS.length]}`} />
    case 'chip':
      return <Bone className="h-[21px] w-[92px] rounded-full" />
    case 'mono':
      return <Bone className="h-3 w-[26px]" />
    case 'date':
      return <Bone className="h-3 w-[150px]" />
    case 'button':
      return <Bone className="ml-auto h-[26px] w-[52px] rounded-[7px]" />
  }
}

/**
 * The registrations or the team's table before its rows arrive: the same
 * card, the same column headings' rhythm, twelve rows of bars shaped like
 * the cells they stand in for. It takes the window's height the way the
 * real table does (`useFillHeight`, `tall-*`), so nothing moves when the
 * rows land.
 */
export default function TableSkeleton({ columns, className = 'mt-4' }: { columns: ColumnShape[]; className?: string }) {
  const card = useFillHeight<HTMLDivElement>()
  return (
    <Loading>
      <div ref={card} className={`card tall-card ${className}`}>
        <div className="tall-scroll overflow-hidden">
          <table className="w-full border-collapse text-[13.5px]" aria-hidden="true">
            <thead className="tall-head">
              <tr>
                {columns.map((c, i) => (
                  <th key={i} className="px-3 py-[11px] text-left">
                    <Bone className={HEAD[c]} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROWS }, (_, r) => (
                <tr key={r} className="border-b border-line last:border-0">
                  {columns.map((c, i) => (
                    <td key={i} className="px-3 py-[11px] align-middle">
                      <Cell shape={c} row={r} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Loading>
  )
}

/**
 * The same rows below `md`, where `RegistrationCards` draws them: four
 * cards of a name, a chip, a mono line and two chips. Hidden from `md` up,
 * as the cards are.
 */
export function CardsSkeleton() {
  return (
    <Loading className="mt-4 md:hidden">
      <ul className="grid list-none gap-2 p-0" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="card px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <Bone className={`h-[15px] ${TEXT_WIDTHS[i % TEXT_WIDTHS.length]} max-w-[200px]`} />
              <Bone className="h-[21px] w-[92px] rounded-full" />
            </div>
            <Bone className="mt-2.5 h-[9px] w-[60%]" />
            <div className="mt-3 flex gap-1.5">
              <Bone className="h-[21px] w-[80px] rounded-full" />
              <Bone className="h-[21px] w-[64px] rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </Loading>
  )
}
