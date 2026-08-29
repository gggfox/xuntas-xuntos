import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import { OPENS_AT_MS, isWindowOpen } from '../lib/cycle'
import RegistrationActions from '../components/Home/RegistrationActions'
import RegistrationBrief from '../components/Home/RegistrationBrief'
import RegistrationClosedNotice from '../components/Home/RegistrationClosedNotice'
import RegistrationLede from '../components/Home/RegistrationLede'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const isOpen = isWindowOpen()
  const beforeOpening = Date.now() < OPENS_AT_MS

  return (
    /*
     * col-560, not the 900 px form column: nothing on this page is wider than
     * the notice, so a 900 px column would only park the whole page left of
     * centre with a third of it empty. The column is the measure now — the
     * lede and the two cards inherit it instead of each capping itself.
     */
    <main className="col col-560 pt-[46px] pb-[90px]">
      <RegistrationLede />
      <RegistrationBrief />
      {isOpen ? <RegistrationActions /> : <RegistrationClosedNotice beforeOpening={beforeOpening} />}
      <p className="eyebrow mt-8">{m.reg_closing()}</p>
    </main>
  )
}
