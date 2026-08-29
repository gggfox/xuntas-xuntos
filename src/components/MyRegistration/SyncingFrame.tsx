import * as m from '../../paraglide/messages.js'

/**
 * The account exists in Clerk but not yet in Convex. The query is reactive:
 * as soon as the webhook inserts the user, this screen replaces itself.
 */
export default function SyncingFrame() {
  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.brand_cycle()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(24px,4vw,32px)]">{m.sync_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.sync_text()}</p>
      <p className="mt-6 text-[12.5px] text-soft">{m.sync_help()}</p>
    </main>
  )
}
