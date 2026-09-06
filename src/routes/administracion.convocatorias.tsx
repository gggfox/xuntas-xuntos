import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import CyclesPanel from '../components/Admin/CyclesPanel'
import NoTools from '../components/Admin/NoTools'
import { useMe } from '../hooks/useMe'
import { can } from '../lib/permissions'

export const Route = createFileRoute('/administracion/convocatorias')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.cycles_title() }) }] }),
  component: () => {
    const me = useMe()
    if (!me) return null
    return can(me.roles, 'manage_cycles') ? <CyclesPanel /> : <NoTools />
  },
})
