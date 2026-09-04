import { Link } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { useDocumentTitle } from '../lib/title'
import { useActiveCycle } from '../hooks/useActiveCycle'

/**
 * What you see when something blows up on the client or in SSR.
 *
 * Without this, a render error left the page blank: someone halfway through
 * filling things in, on their phone, with no idea whether their motivation
 * letter got saved. The important thing this screen says is that the draft
 * is safe, because it usually is true —it autosaves— and it is the only
 * thing the person is wondering.
 *
 * The error is sent to the console with a stable prefix so it can be found
 * in the Dokploy logs.
 */
export default function ErrorScreen({ error }: { error: Error }) {
  console.error('[ui] unhandled error:', error)
  useDocumentTitle(m.error_title())
  const c = useActiveCycle()

  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.brand_cycle({ cycle: c?.cycle ?? '' })}</p>
      <h1 className="h-display mt-[7px] text-[clamp(24px,4vw,32px)]">{m.error_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.error_text()}</p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          {m.error_retry()}
        </button>
        <Link to="/mi-registro" className="btn btn-ghost no-underline">
          {m.nav_my_registration()}
        </Link>
      </div>

      {/*
        The technical message goes at the end and in a quiet voice: it is of
        no use to the person registering, but it saves a round trip for
        whoever receives the support email with a screenshot.
      */}
      <p className="mt-8 font-mono text-[11px] break-words text-soft">{error.message}</p>
    </main>
  )
}
