import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import { isUnderage, savePreSignupToken } from '../lib/preSignup'

export const Route = createFileRoute('/empezar')({
  component: AgeGate,
})

/**
 * Age gate. It goes BEFORE the Clerk sign-up, on purpose.
 *
 * If we only asked for the birth date at the form, a minor's account would
 * already exist before we knew their guardian's authorization was needed.
 * Here we know it first, and the guardian email goes out together with the
 * sign-up.
 *
 * The SERVER makes the decision: this screen sends the date to
 * `preSignups.create` and stores the token it returns. The `isUnderage`
 * below only serves to progressively reveal the guardian fields while the
 * date is being typed; it is not what determines anything.
 */
function AgeGate() {
  const navigate = useNavigate()
  const createPreSignup = useMutation(api.preSignups.create)
  const [birthDate, setBirthDate] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const isMinor = birthDate ? isUnderage(birthDate) : false

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!birthDate) {
      e.birthDate = m.gate_date_error()
    } else {
      const d = new Date(birthDate)
      if (d.getTime() > Date.now()) e.birthDate = m.gate_date_future()
      else if (d.getUTCFullYear() < 1930) e.birthDate = m.gate_date_implausible()
    }
    if (isMinor) {
      if (!guardianName.trim()) e.guardianName = m.gate_guardian_name_error()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guardianEmail)) e.guardianEmail = m.gate_guardian_email_error()
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleContinue(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const { token } = await createPreSignup({
        birthDate,
        guardianName: isMinor ? guardianName.trim() : undefined,
        guardianEmail: isMinor ? guardianEmail.trim().toLowerCase() : undefined,
      })
      savePreSignupToken(token)
      await navigate({ to: '/crear-cuenta' })
    } catch (err) {
      // The server revalidates everything. If it rejects, its message is
      // shown: it can know things the client doesn't, like the date not
      // having a valid shape.
      setErrors({
        birthDate: err instanceof Error ? err.message : m.gate_date_error(),
      })
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.gate_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.gate_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.gate_lede()}</p>

      <form onSubmit={handleContinue} noValidate className="mt-8">
        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="dob" className="text-[12.5px] font-medium">
            {m.gate_date_label()} <span className="text-bad">*</span>
          </label>
          <input
            id="dob"
            type="date"
            className="fld-input"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            aria-invalid={Boolean(errors.birthDate)}
            aria-describedby={errors.birthDate ? 'dob-err' : undefined}
            autoComplete="bday"
            required
          />
          {errors.birthDate && (
            <p id="dob-err" className="text-[11.5px] text-bad">
              {errors.birthDate}
            </p>
          )}
        </div>

        {isMinor && (
          <section className="nota mb-5">
            <b className="mb-1.5 block font-disp text-[14.5px]">{m.gate_minor_title()}</b>
            <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
              {m.gate_minor_text()}
            </p>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="gn" className="text-[12.5px] font-medium">
                {m.gate_guardian_name()} <span className="text-bad">*</span>
              </label>
              <input
                id="gn"
                className="fld-input"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                aria-invalid={Boolean(errors.guardianName)}
                autoComplete="off"
              />
              {errors.guardianName && (
                <p className="text-[11.5px] text-bad">{errors.guardianName}</p>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <label htmlFor="ge" className="text-[12.5px] font-medium">
                {m.gate_guardian_email()} <span className="text-bad">*</span>
              </label>
              <input
                id="ge"
                type="email"
                className="fld-input"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                aria-invalid={Boolean(errors.guardianEmail)}
                autoComplete="off"
              />
              <p className="text-[11.5px] text-soft">{m.gate_guardian_help()}</p>
              {errors.guardianEmail && <p className="text-[11.5px] text-bad">{errors.guardianEmail}</p>}
            </div>
          </section>
        )}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? m.common_loading() : m.common_continue()}
        </button>
      </form>
    </main>
  )
}
