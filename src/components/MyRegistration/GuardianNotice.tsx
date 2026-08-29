import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'

/**
 * Guardian notice. It is the loudest thing on the screen on purpose: if it
 * doesn't get confirmed, the account stays incomplete and a person has to
 * resolve it.
 */
export default function GuardianNotice() {
  const resend = useMutation(api.guardian.resend)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleResend() {
    setBusy(true)
    try {
      const r = await resend({})
      if (r.ok) setMessage(m.guardian_resent())
      // `too_many` is the per-cycle send cap: it is no longer a delivery
      // problem and waiting five minutes is not going to fix it.
      else if (r.reason === 'too_many') setMessage(m.guardian_too_many())
      else setMessage(m.guardian_wait())
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="nota mt-6 max-w-[62ch] border-bad/40 bg-bad/5">
      <b className="mb-1.5 block font-disp text-[14.5px]">{m.guardian_missing_title()}</b>
      <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
        {m.guardian_missing_text()}
      </p>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost" onClick={handleResend} disabled={busy}>
          {busy ? m.common_loading() : m.guardian_resend()}
        </button>
        {message && <span className="text-[12.5px] text-soft">{message}</span>}
      </div>
    </section>
  )
}
