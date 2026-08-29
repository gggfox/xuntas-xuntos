import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import DateField from '../DateField'
import GuardianFields from '../GuardianFields'
import { isUnderage } from '../../lib/preSignup'

/**
 * Age-gate recovery for an account that ended up without a birth date.
 *
 * It is the same deal as in `/empezar`: the date is sent to the server, the
 * server decides whether they are a minor and, if so, requires and notifies
 * the guardian. It can be done only once — if it could be changed later,
 * declaring yourself an adult would be enough to shake the guardian off.
 */
export default function BirthDateStep() {
  const declareBirthDate = useMutation(api.users.declareBirthDate)
  const [birthDate, setBirthDate] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isMinor = birthDate ? isUnderage(birthDate) : false

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await declareBirthDate({
        birthDate,
        guardianName: isMinor ? guardianName.trim() : undefined,
        guardianEmail: isMinor ? guardianEmail.trim().toLowerCase() : undefined,
      })
      // No need to navigate: `myStatus` is reactive and this screen replaces
      // itself with the form as soon as the mutation confirms.
    } catch (err) {
      setError(err instanceof Error ? err.message : m.gate_date_error())
      setSubmitting(false)
    }
  }

  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.gate_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.gate_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.age_missing_text()}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8">
        <div className="mb-4">
          <DateField
            id="dob2"
            label={m.gate_date_label()}
            req
            inline
            value={birthDate}
            onChange={setBirthDate}
            autoComplete="bday"
          />
        </div>

        {isMinor && (
          <GuardianFields
            idPrefix="guardian-recovery"
            name={guardianName}
            onNameChange={setGuardianName}
            email={guardianEmail}
            onEmailChange={setGuardianEmail}
          />
        )}

        {error && <p className="mb-3 text-[12.5px] text-bad">{error}</p>}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? m.common_loading() : m.common_continue()}
        </button>
      </form>
    </main>
  )
}
