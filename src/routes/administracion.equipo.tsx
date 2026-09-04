import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'

// Stub so the typed links to /administracion/equipo compile; Task 10 replaces this.
export const Route = createFileRoute('/administracion/equipo')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.admin_nav_staff() }) }] }),
  component: () => null,
})
