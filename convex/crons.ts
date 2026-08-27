import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

/**
 * Las pre-altas que nadie usó llevan la fecha de nacimiento de una persona
 * posiblemente menor y el correo de su tutor. Vencen a las dos horas; esto las
 * borra. Cada hora es suficiente: no hay prisa, pero tampoco se acumulan.
 */
crons.interval('borrar pre-altas vencidas', { hours: 1 }, internal.preAltas.limpiar, {})

export default crons
