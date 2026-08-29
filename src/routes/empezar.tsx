import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import DateField from '../components/DateField'
import GuardianFields from '../components/GuardianFields'
import { isUnderage, savePreSignupToken } from '../lib/preSignup'
import { describeConvexError } from '../lib/registrationErrors'

export const Route = createFileRoute('/empezar')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.meta_start() }) }] }),
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
      // The server revalidates everything. If it rejects, its code is
      // rendered here: it can know things the client doesn't, like the date
      // not having a valid shape. Reading the code rather than the thrown
      // message is what keeps that sentence in the reader's language.
      setErrors({ birthDate: describeConvexError(err) })
      setSubmitting(false)
    }
  }

  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.gate_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.gate_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.gate_lede()}</p>

      <form onSubmit={handleContinue} noValidate className="mt-8">
        <div className="mb-4">
          <DateField
            id="dob"
            label={m.gate_date_label()}
            req
            inline
            value={birthDate}
            onChange={setBirthDate}
            error={errors.birthDate}
            autoComplete="bday"
          />
        </div>

        {isMinor && (
          <GuardianFields
            idPrefix="guardian"
            name={guardianName}
            onNameChange={setGuardianName}
            email={guardianEmail}
            onEmailChange={setGuardianEmail}
            errors={{ name: errors.guardianName, email: errors.guardianEmail }}
          />
        )}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? m.common_loading() : m.common_continue()}
        </button>
      </form>
    </main>
  )
}
