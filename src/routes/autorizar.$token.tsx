import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'

export const Route = createFileRoute('/autorizar/$token')({
  component: Authorize,
})

/**
 * The guardian's screen. No session: whoever opens the link has no account
 * and shouldn't have to create one. The token is the credential.
 */
function Authorize() {
  const { token } = Route.useParams()
  const request = useQuery(api.guardian.getRequest, { token })
  const confirm = useMutation(api.guardian.confirm)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function authorize() {
    setSubmitting(true)
    try {
      const r = await confirm({
        token,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : undefined,
      })
      setResult(r.reason)
    } finally {
      setSubmitting(false)
    }
  }

  if (request === undefined) {
    return <Frame>{m.common_loading()}</Frame>
  }

  const status = result ?? request.status

  if (status === 'confirmed' || status === 'already_confirmed') {
    return (
      <Frame title={status === 'confirmed' ? m.authorize_ok_title() : m.authorize_already_title()}>
        <p className="font-light text-soft">
          {status === 'confirmed' ? m.authorize_ok_text() : m.authorize_already_text()}
        </p>
      </Frame>
    )
  }

  if (status === 'expired') {
    return (
      <Frame title={m.authorize_expired_title()}>
        <p className="font-light text-soft">{m.authorize_expired_text()}</p>
      </Frame>
    )
  }

  if (status === 'invalid') {
    return (
      <Frame title={m.authorize_invalid_title()}>
        <p className="font-light text-soft">{m.authorize_invalid_text()}</p>
      </Frame>
    )
  }

  return (
    <Frame title={m.authorize_title()}>
      <p className="font-light text-soft">
        <b className="font-medium text-ink">{request.athleteName}</b> se registró a la{' '}
        {m.brand_cycle()} del Programa de Desarrollo de {m.brand_name()} y te señaló como su
        padre, madre o tutor.
      </p>
      <p className="mt-3 font-light text-soft">
        Como es menor de edad, necesitamos tu autorización para crear su cuenta y tratar sus datos.
        No hay ningún documento que cargar.
      </p>
      <button className="btn mt-7" onClick={authorize} disabled={submitting}>
        {submitting ? m.common_loading() : m.authorize_confirm()}
      </button>
    </Frame>
  )
}

function Frame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.authorize_eyebrow()}</p>
      {title && <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,36px)]">{title}</h1>}
      <div className="mt-5">{children}</div>
    </main>
  )
}
