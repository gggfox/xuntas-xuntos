import { useUser } from '@clerk/tanstack-react-start'
import { useMutation, useQuery } from 'convex/react'
import { useCallback } from 'react'
import { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import RegistrationForm from '../RegistrationForm'
import AccountStatus from './AccountStatus'
import BirthDateStep from './BirthDateStep'
import GuardianNotice from './GuardianNotice'
import LoadingFrame from './LoadingFrame'
import SyncingFrame from './SyncingFrame'
import { prepareForSubmit, emptyRegistration, type RegistrationData } from '../../lib/registrationSchema'
import { errorCodeFromConvex } from '../../lib/registrationErrors'
import type { RegistrationError } from '../../lib/registrationRules'

/**
 * Everything behind the sign-in wall: the form itself, plus the screens that
 * stand in for it while the account is not ready to fill it out.
 */
export default function RegistrationPanel() {
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

  // Convex returns undefined while the query is in flight.
  if (status === undefined || mine === undefined) {
    return <LoadingFrame>{m.common_loading()}</LoadingFrame>
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
    <main className="col pt-[38px] pb-[90px]">
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
