import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { useActiveCycle } from '../hooks/useActiveCycle'
import RegistrationActions from '../components/Home/RegistrationActions'
import RegistrationBrief from '../components/Home/RegistrationBrief'
import RegistrationClosedNotice from '../components/Home/RegistrationClosedNotice'
import RegistrationLede from '../components/Home/RegistrationLede'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const c = useActiveCycle()

  return (
    /*
     * col-560, not the 900 px form column: nothing on this page is wider than
     * the notice, so a 900 px column would only park the whole page left of
     * centre with a third of it empty. The column is the measure now — the
     * lede and the two cards inherit it instead of each capping itself.
     */
    <main className="col col-560 pt-[46px] pb-[90px]">
      <RegistrationLede title={c?.title ?? ''} titleReady={!!c} />
      <RegistrationBrief />
      {/* `undefined` while the query is in flight, `null` if no cycle is
          active (a configuration fault): either way, nothing renders here
          rather than a guess at whether the window is open. */}
      {!c ? null : c.isOpen ? (
        <RegistrationActions />
      ) : (
        <RegistrationClosedNotice
          beforeOpening={c.beforeOpening}
          title={c.title}
          opensOnText={c.opensOnText}
          closesOnText={c.closesOnText}
        />
      )}
      {c && <p className="eyebrow mt-8">{m.reg_closing({ date: c.closesOnText })}</p>}
    </main>
  )
}
