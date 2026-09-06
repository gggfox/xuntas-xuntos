import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import Pill from '../Pill'

export type MyStatus = NonNullable<FunctionReturnType<typeof api.users.myStatus>>

type Props = {
  status: MyStatus
  alreadySubmitted: boolean
}

/**
 * The three status axes, visible at once. The person filling this out needs
 * to know at a glance what they are missing and what depends on someone else.
 */
export default function AccountStatus({ status, alreadySubmitted }: Props) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Pill tone={status.account.emailVerified ? 'ok' : 'warn'}>
        {status.account.emailVerified ? 'Correo verificado' : 'Falta verificar correo'}
      </Pill>
      {status.guardian.required && (
        <Pill tone={status.guardian.confirmed ? 'ok' : 'bad'}>
          {status.guardian.confirmed ? 'Tutor autorizó' : 'Falta autorización del tutor'}
        </Pill>
      )}
      <Pill tone={alreadySubmitted ? 'ok' : 'neutral'}>
        {alreadySubmitted ? 'Registro enviado' : 'Borrador'}
      </Pill>
    </div>
  )
}
