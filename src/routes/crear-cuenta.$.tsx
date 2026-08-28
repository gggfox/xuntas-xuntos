import { createFileRoute } from '@tanstack/react-router'
import SignUpScreen from '../components/SignUpScreen'

export const Route = createFileRoute('/crear-cuenta/$')({
  component: SignUpScreen,
})
