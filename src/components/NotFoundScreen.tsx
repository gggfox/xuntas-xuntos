import { Link } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { useDocumentTitle } from '../lib/title'
import { useActiveCycle } from '../hooks/useActiveCycle'

/**
 * 404. It happens more than it seems: links get shared over WhatsApp and
 * arrive truncated, and the guardian link is long.
 */
export default function NotFoundScreen() {
  useDocumentTitle(m.nf_title())
  const c = useActiveCycle()

  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      {c && <p className="eyebrow">{m.brand_cycle({ cycle: c.cycle })}</p>}
      <h1 className="h-display mt-[7px] text-[clamp(24px,4vw,32px)]">{m.nf_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.nf_text()}</p>
      <Link to="/" className="btn mt-7 inline-block no-underline">
        {m.nf_home()}
      </Link>
    </main>
  )
}
