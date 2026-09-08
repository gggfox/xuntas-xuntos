import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import { canSeeAthletes } from '../components/Admin/AdminShell'
import AthleteCards from '../components/Admin/AthleteCards'
import AthletesTable from '../components/Admin/AthletesTable'
import NoTools from '../components/Admin/NoTools'
import Segmented, { segmentId } from '../components/Segmented'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'

type Branch = 'womens' | 'mens'
type BranchView = Branch | 'all'

export const Route = createFileRoute('/administracion/atletas')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.admin_nav_athletes() }) }] }),
  validateSearch: (s: Record<string, unknown>): { rama?: Branch } =>
    s.rama === 'womens' || s.rama === 'mens' ? { rama: s.rama } : {},
  component: AthletesPage,
})

const PANEL_ID = 'atletas-panel'

/**
 * The members this account may see — every one for administration, the
 * assigned ones for a coach or a health specialist. The server decides
 * which; this page only asks.
 */
function AthletesPage() {
  const me = useMe()
  const { rama } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const rows = useQuery(api.members.list, me && canSeeAthletes(me.roles) ? { branch: rama } : 'skip')

  if (!me) return null
  if (!canSeeAthletes(me.roles)) return <NoTools />

  const view: BranchView = rama ?? 'all'
  const showStaff = can(me.roles, 'view_all_athletes')

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          name="atletas"
          label={m.athletes_filter_branch()}
          value={view}
          panelId={PANEL_ID}
          items={[
            { id: 'all', label: m.athletes_all() },
            { id: 'womens', label: m.reg_branch_womens() },
            { id: 'mens', label: m.reg_branch_mens() },
          ]}
          onChange={(v) => void navigate({ search: v === 'all' ? {} : { rama: v }, replace: true })}
        />
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={segmentId('atletas', view)}>
        {rows === undefined ? (
          <p className="mt-8 text-soft">{m.common_loading()}</p>
        ) : (
          <>
            <AthletesTable
              rows={rows}
              showStaff={showStaff}
              onOpen={(id) => void navigate({ to: '/administracion/atletas/$id', params: { id } })}
            />
            <AthleteCards rows={rows} onOpen={(id) => void navigate({ to: '/administracion/atletas/$id', params: { id } })} />
          </>
        )}
      </div>
    </>
  )
}
