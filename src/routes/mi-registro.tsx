import { Show, useUser } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import RegistrationForm from '../components/RegistrationForm'
import { prepareForSubmit, emptyRegistration, type RegistrationData } from '../lib/form'
import { REVIEW_DATE } from '../lib/cycle'
import { isUnderage } from '../lib/preSignup'

export const Route = createFileRoute('/mi-registro')({
  component: MyRegistration,
})

function MyRegistration() {
  return (
    <>
      <Show when="signed-out">
        <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
          <h1 className="h-display text-[clamp(26px,4.6vw,36px)]">{m.nav_sign_in()}</h1>
          <p className="mt-3 font-light text-soft">{m.account_no_password()}</p>
          <Link to="/entrar" className="btn mt-6 inline-block no-underline">
            {m.nav_sign_in()}
          </Link>
        </main>
      </Show>
      <Show when="signed-in">
        <Panel />
      </Show>
    </>
  )
}

function Panel() {
  const { user } = useUser()
  const status = useQuery(api.users.myStatus)
  const mine = useQuery(api.registrations.mine)
  const saveDraft = useMutation(api.registrations.saveDraft)
  const submitRegistration = useMutation(api.registrations.submit)

  /**
   * Stable on purpose. These two go in as dependencies of the autosave
   * effect; if they were recreated on every render, each write would restart
   * the timer and the form would keep saving itself, in a loop.
   */
  const handleSaveDraft = useCallback(
    (d: RegistrationData) => {
      void saveDraft({ data: prepareForSubmit(d) })
    },
    [saveDraft],
  )

  const handleSubmit = useCallback(
    async (d: RegistrationData) => {
      const r = await submitRegistration({ data: prepareForSubmit(d) })
      return r.ok ? [] : r.errors
    },
    [submitRegistration],
  )

  // Convex returns undefined while the query is in flight.
  if (status === undefined || mine === undefined) {
    return <Frame>{m.common_loading()}</Frame>
  }

  // null means Convex didn't find the user. It happens for a few seconds
  // after sign-up, while the `user.created` webhook lands. This used to show
  // "Loading…" forever and there was no way to tell whether the webhook was
  // misconfigured or just running late. Now it says what is going on.
  if (status === null || mine === null) {
    return <SyncingFrame />
  }

  /**
   * The account exists but we don't know its age: it was created without a
   * valid pre-signup (the real case is the Google detour, where the token can
   * get lost).
   *
   * We ask before letting them touch the form. Adulthood is not assumed:
   * assuming it was exactly the gap through which a minor could register
   * without their guardian ever being asked for authorization.
   */
  if (!status.account.ageDeclared) {
    return <BirthDateStep />
  }

  const initial: RegistrationData = mine.registration
    ? {
        personal: mine.registration.personal,
        academic: mine.registration.academic,
        athletic: mine.registration.athletic,
        results: mine.registration.results,
        rankings: mine.registration.rankings,
        calendar: mine.registration.calendar,
        motivationLetter: mine.registration.motivationLetter,
        confirmations: mine.registration.confirmations,
      }
    : emptyRegistration({
        name: user?.fullName ?? '',
        email: user?.primaryEmailAddress?.emailAddress ?? '',
      })

  const alreadySubmitted =
    mine.registration?.status === 'submitted' || mine.registration?.status === 'validated'

  return (
    <main className="mx-auto max-w-[900px] px-[22px] pt-[38px] pb-[90px]">
      <p className="eyebrow">{m.reg_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.reg_title()}</h1>

      <AccountStatus status={status} alreadySubmitted={alreadySubmitted} />

      {status.guardian.required && !status.guardian.confirmed && <GuardianNotice />}

      <div className="mt-9">
        <RegistrationForm
          initial={initial}
          editable={mine.editable}
          alreadySubmitted={alreadySubmitted}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  )
}

/**
 * The three status axes, visible at once. The person filling this out needs
 * to know at a glance what they are missing and what depends on someone else.
 */
function AccountStatus({
  status,
  alreadySubmitted,
}: {
  status: NonNullable<ReturnType<typeof useQuery<typeof api.users.myStatus>>>
  alreadySubmitted: boolean
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <span className={status.account.emailVerified ? 'chip chip-ok' : 'chip chip-warn'}>
        {status.account.emailVerified ? 'Correo verificado' : 'Falta verificar correo'}
      </span>
      {status.guardian.required && (
        <span className={status.guardian.confirmed ? 'chip chip-ok' : 'chip chip-bad'}>
          {status.guardian.confirmed ? 'Tutor autorizó' : 'Falta autorización del tutor'}
        </span>
      )}
      <span className={alreadySubmitted ? 'chip chip-ok' : 'chip'}>
        {alreadySubmitted ? 'Registro enviado' : 'Borrador'}
      </span>
    </div>
  )
}

/**
 * Guardian notice. It is the loudest thing on the screen on purpose: if it
 * doesn't get confirmed, the account stays incomplete and a person has to
 * resolve it.
 */
function GuardianNotice() {
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

/**
 * Age-gate recovery for an account that ended up without a birth date.
 *
 * It is the same deal as in `/empezar`: the date is sent to the server, the
 * server decides whether they are a minor and, if so, requires and notifies
 * the guardian. It can be done only once — if it could be changed later,
 * declaring yourself an adult would be enough to shake the guardian off.
 */
function BirthDateStep() {
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
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.gate_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.gate_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.age_missing_text()}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8">
        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="dob2" className="text-[12.5px] font-medium">
            {m.gate_date_label()} <span className="text-bad">*</span>
          </label>
          <input
            id="dob2"
            type="date"
            className="fld-input"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            autoComplete="bday"
            required
          />
        </div>

        {isMinor && (
          <section className="nota mb-5">
            <b className="mb-1.5 block font-disp text-[14.5px]">{m.gate_minor_title()}</b>
            <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
              {m.gate_minor_text()}
            </p>
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="gn2" className="text-[12.5px] font-medium">
                {m.gate_guardian_name()} <span className="text-bad">*</span>
              </label>
              <input
                id="gn2"
                className="fld-input"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <label htmlFor="ge2" className="text-[12.5px] font-medium">
                {m.gate_guardian_email()} <span className="text-bad">*</span>
              </label>
              <input
                id="ge2"
                type="email"
                className="fld-input"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[11.5px] text-soft">{m.gate_guardian_help()}</p>
            </div>
          </section>
        )}

        {error && <p className="mb-3 text-[12.5px] text-bad">{error}</p>}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? m.common_loading() : m.common_continue()}
        </button>
      </form>
    </main>
  )
}

/**
 * The account exists in Clerk but not yet in Convex. The query is reactive:
 * as soon as the webhook inserts the user, this screen replaces itself.
 */
function SyncingFrame() {
  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.brand_cycle()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(24px,4vw,32px)]">
        {m.sync_title()}
      </h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.sync_text()}</p>
      <p className="mt-6 text-[12.5px] text-soft">{m.sync_help()}</p>
    </main>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[900px] px-[22px] pt-[46px] pb-[90px]">
      <p className="text-soft">{children}</p>
      <p className="eyebrow mt-4">
        {m.done_review()} · {REVIEW_DATE}
      </p>
    </main>
  )
}
