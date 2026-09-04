import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as m from '../paraglide/messages.js'
import DecisionPanel from '../components/Admin/DecisionPanel'
import NoTools from '../components/Admin/NoTools'
import RegistrationDetail from '../components/Admin/RegistrationDetail'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'

export const Route = createFileRoute('/administracion/registros/$id')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.regs_title() }) }] }),
  component: DetailPage,
})

function DetailPage() {
  const { id } = Route.useParams()
  const me = useMe()
  const detail = useQuery(api.registrations.detail, me && can(me.roles, 'review_registrations') ? { id: id as Id<'registrations'> } : 'skip')
  const decide = useMutation(api.registrations.decide)
  const sendRejection = useMutation(api.notices.sendRejection)

  if (!me) return null
  if (!can(me.roles, 'review_registrations')) return <NoTools />
  if (detail === undefined) return <p className="mt-8 text-soft">{m.common_loading()}</p>

  const r = detail.registration
  return (
    <>
      <Link to="/administracion/registros" className="mt-6 inline-block text-[13px] text-soft no-underline hover:text-ink">
        ← {m.detail_back()}
      </Link>
      <h2 className="h-display mt-3 text-[clamp(22px,3.6vw,30px)]">{r.personal.name || detail.account.email}</h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <RegistrationDetail detail={detail} />
        <DecisionPanel
          status={r.status}
          guardianConfirmed={detail.guardian.confirmed}
          notice={r.decisionNotice?.status ?? null}
          permissions={me.permissions}
          log={detail.log}
          onDecide={async (decision, note) => {
            await decide({ id: r._id, decision, note: note || undefined })
          }}
          onSendRejection={async () => {
            await sendRejection({ id: r._id })
          }}
        />
      </div>
    </>
  )
}
