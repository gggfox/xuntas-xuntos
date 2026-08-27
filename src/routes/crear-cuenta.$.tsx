import { createFileRoute } from '@tanstack/react-router'
import PantallaCrearCuenta from '../components/PantallaCrearCuenta'

export const Route = createFileRoute('/crear-cuenta/$')({
  component: PantallaCrearCuenta,
})
