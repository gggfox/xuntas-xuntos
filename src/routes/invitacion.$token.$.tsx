import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import InviteScreen from '../components/InviteScreen'

/** Clerk's internal steps (code, SSO callback) route under the invite path. */
export const Route = createFileRoute('/invitacion/$token/$')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.invite_title() }) }] }),
  component: InviteScreen,
})
