import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import CyclesPanel from '../components/Admin/CyclesPanel'
import NoTools from '../components/Admin/NoTools'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'

export const Route = createFileRoute('/administracion/periodos')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.cycles_title() }) }] }),
  component: () => {
    const me = useMe()
    if (!me) return null
    if (!can(me.roles, 'manage_cycles')) return <NoTools />
    // A list of a few cards, not a wide table: it keeps to BRAND.md's 1240
    // inside the admin frame. See `AdminShell`.
    return (
      <div className="max-w-[1240px]">
        <CyclesPanel />
      </div>
    )
  },
})
