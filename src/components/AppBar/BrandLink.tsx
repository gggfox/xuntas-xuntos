import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import Icons from '../Icons'
import { useActiveCycle } from '../../hooks/useActiveCycle'

/**
 * The left half of the header: who this is, and the way back home.
 *
 * The mark is the real one from xuntas.org. The name beside it stays
 * "XUNTAS–XUNTOS": the site's wordmark reads "XUNTAS" alone, and this is the
 * registration for a program that has a men's branch. Under it the cycle,
 * so the page says which year it is registering for before anything is read.
 */
export default function BrandLink() {
  const c = useActiveCycle()
  return (
    <Link to="/" className="flex min-w-0 items-center gap-[11px] no-underline">
      <Icons.BrandMark className="h-[26px] w-auto flex-none text-yel" />
      <span className="min-w-0">
        <b className="block font-disp text-[16px] leading-[1.15] font-bold">{m.brand_name()}</b>
        {c && (
          <span className="font-mono text-[10px] tracking-[.12em] text-white/50 uppercase">
            {m.brand_cycle({ cycle: c.cycle })}
          </span>
        )}
      </span>
    </Link>
  )
}
