import { createFileRoute } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'
import SignInScreen from '../components/SignInScreen'

export const Route = createFileRoute('/entrar/$')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.nav_sign_in() }) }] }),
  component: SignInScreen,
})
