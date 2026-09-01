import * as m from '../../paraglide/messages.js'

/**
 * Clerk considers the reader signed in, but Convex rejected the session, so
 * every query comes back as if there were nobody there.
 *
 * This is a wiring fault, not a wait: nothing about it resolves on its own,
 * and it needs the token to carry `aud: "convex"` — see the Clerk section of
 * the README. It used to fall through to `SyncingFrame`, which told the
 * reader their account was being prepared while it had existed for days.
 */
export default function SessionFrame() {
  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.brand_cycle()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(24px,4vw,32px)]">{m.session_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.session_text()}</p>
      <p className="mt-6 text-[12.5px] text-soft">{m.session_help()}</p>
    </main>
  )
}
