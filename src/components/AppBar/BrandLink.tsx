import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import Icons from '../Icons'
import { useActiveCycle } from '../../hooks/useActiveCycle'

/**
 * The left half of the header: who this is, and the way back home.
 *
 * The mark is the real one from xuntas.org, and the name beside it reads
 * "XUNTAS" alone, the way the site's own lockup does. Under it the cycle,
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
            {c.title}
          </span>
        )}
      </span>
    </Link>
  )
}
