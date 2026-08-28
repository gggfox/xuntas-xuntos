import { createFileRoute } from '@tanstack/react-router'
import SignInScreen from '../components/SignInScreen'

export const Route = createFileRoute('/entrar/')({
  component: SignInScreen,
})
