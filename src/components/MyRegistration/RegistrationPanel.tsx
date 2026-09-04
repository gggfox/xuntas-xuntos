import { useUser } from '@clerk/tanstack-react-start'
import { Navigate } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useCallback } from 'react'
import { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import Meteors from '../Meteors'
import RegistrationForm from '../RegistrationForm'
import AccountStatus from './AccountStatus'
import BirthDateStep from './BirthDateStep'
import GuardianNotice from './GuardianNotice'
import LoadingFrame from './LoadingFrame'
import SessionFrame from './SessionFrame'
import SyncingFrame from './SyncingFrame'
import { prepareForSubmit, emptyRegistration, type RegistrationData } from '../../lib/registrationSchema'
import { errorCodeFromConvex } from '../../lib/registrationErrors'
import type { RegistrationError } from '../../lib/registrationRules'
import { useActiveCycle } from '../../hooks/useActiveCycle'

/**
 * Everything behind the sign-in wall: the form itself, plus the screens that
 * stand in for it while the account is not ready to fill it out.
 */
export default function RegistrationPanel({
  step,
  onStepChange,
}: {
  /** The step the URL asked for. The form decides whether it is allowed. */
  step?: number
  onStepChange?: (step: number) => void
} = {}) {
  const { user } = useUser()
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const status = useQuery(api.users.myStatus)
  const mine = useQuery(api.registrations.mine)
  const saveDraft = useMutation(api.registrations.saveDraft)
  const submitRegistration = useMutation(api.registrations.submit)
  const cycle = useActiveCycle()

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
    async (d: RegistrationData): Promise<RegistrationError[]> => {
      try {
        const r = await submitRegistration({ data: prepareForSubmit(d) })
        return r.ok ? [] : r.errors
      } catch (err) {
        // A thrown error is about the action, not a field: the window closed,
        // the registration was already reviewed. Surface it as a form-level
        // problem rather than losing it — before this, the throw escaped the
        // handler and the user saw nothing happen at all.
        return [{ field: 'form', code: errorCodeFromConvex(err) ?? 'generic' }]
      }
    },
    [submitRegistration],
  )

  // Convex returns undefined while the query is in flight, and the session is
  // still worth nothing until Clerk's token has been exchanged. `!cycle`
  // covers both "still loading" and "no active cycle" (a configuration
  // fault the UI does not design for) — either way, nothing below this
  // point may render a sentence that needs a date it does not have yet.
  if (authLoading || status === undefined || mine === undefined || !cycle) {
    return <LoadingFrame reviewOnText={cycle?.reviewOnText}>{m.common_loading()}</LoadingFrame>
  }

  /**
   * Signed in as far as Clerk is concerned, yet Convex refuses the session.
   * The queries answer null here for the same reason they do for a missing
   * user — `currentUser` cannot tell them apart — so the difference has to be
   * read from the auth state instead of from the data.
   *
   * Without this the reader fell into `SyncingFrame` and was told to wait for
   * an account that already existed. Nothing was coming: the token was never
   * accepted in the first place.
   */
  if (!isAuthenticated) {
    return <SessionFrame />
  }

  // Authenticated, and still no row: the `user.created` webhook has not landed
  // yet. That one really does resolve on its own, in a few seconds.
  if (status === null || mine === null) {
    return <SyncingFrame />
  }

  /**
   * Staff have no registration. Clerk's fallback redirect still points at this
   * page (a build arg, not worth a rebuild), so the page itself sends them on.
   * Before the birth-date step, on purpose: a staff account has no date and
   * must never be asked for one.
   */
  if (!status.account.roles.includes('athlete')) {
    return <Navigate to="/administracion" />
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
    <main className="relative isolate col pt-[38px] pb-[90px]">
      <Meteors />
      <p className="eyebrow">{m.reg_eyebrow({ title: cycle.title })}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.reg_title()}</h1>

      <AccountStatus status={status} alreadySubmitted={alreadySubmitted} />

      {status.guardian.required && !status.guardian.confirmed && <GuardianNotice />}

      <div className="mt-9">
        <RegistrationForm
          initial={initial}
          editable={mine.editable}
          alreadySubmitted={alreadySubmitted}
          closesOnText={cycle.closesOnText}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
          /* All three are true by the time this renders — the panel returns
             earlier otherwise — and that is the point: the bar used to open
             at nothing for someone who had already done all of it. */
          account={{
            created: true,
            emailVerified: status.account.emailVerified,
            ageDeclared: status.account.ageDeclared,
          }}
          initialStep={step}
          onStepChange={onStepChange}
        />
      </div>
    </main>
  )
}
