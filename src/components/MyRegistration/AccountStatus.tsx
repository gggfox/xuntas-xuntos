import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import * as m from '../../paraglide/messages.js'
import Pill from '../Pill'

type MyStatus = NonNullable<FunctionReturnType<typeof api.users.myStatus>>

type Props = {
  status: MyStatus
  alreadySubmitted: boolean
}

/**
 * The three status axes, visible at once. The person filling this out needs
 * to know at a glance what they are missing and what depends on someone else.
 *
 * The third pill says the most it can: a member of the program outranks a
 * sent registration, which outranks a draft. A decided registration still
 * reads "enviado" — the decision itself arrives by email, and the pill is
 * not the place to break news.
 */
export default function AccountStatus({ status, alreadySubmitted }: Props) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Pill tone={status.account.emailVerified ? 'ok' : 'warn'}>
        {status.account.emailVerified ? m.status_email_verified() : m.status_email_unverified()}
      </Pill>
      {status.guardian.required && (
        <Pill tone={status.guardian.confirmed ? 'ok' : 'bad'}>
          {status.guardian.confirmed ? m.status_guardian_ok() : m.status_guardian_missing()}
        </Pill>
      )}
      {status.member ? (
        <Pill tone="ok">{m.status_member()}</Pill>
      ) : (
        <Pill tone={alreadySubmitted ? 'ok' : 'neutral'}>
          {alreadySubmitted ? m.status_submitted() : m.status_draft()}
        </Pill>
      )}
    </div>
  )
}
