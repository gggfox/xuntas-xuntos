import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import SignUpScreen from '../components/SignUpScreen'

export const Route = createFileRoute('/crear-cuenta/')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.account_title() }) }] }),
  component: SignUpScreen,
})
