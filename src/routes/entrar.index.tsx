import { createFileRoute } from '@tanstack/react-router'
import PantallaEntrar from '../components/PantallaEntrar'

export const Route = createFileRoute('/entrar/')({
  component: PantallaEntrar,
})
