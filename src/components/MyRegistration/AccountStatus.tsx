import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'

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
