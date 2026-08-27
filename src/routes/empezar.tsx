import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import { esMenorDeEdad, guardarTokenPreAlta } from '../lib/preAlta'

export const Route = createFileRoute('/empezar')({
  component: FiltroEdad,
})

/**
 * Filtro de edad. Va ANTES del alta en Clerk, a propósito.
 *
 * Si preguntáramos la fecha de nacimiento hasta el formulario, la cuenta de una
 * persona menor de edad ya existiría antes de saber que hacía falta la
 * autorización de su tutor. Aquí lo sabemos primero y el correo al tutor sale
 * junto con el alta.
 *
 * La decisión la toma el SERVIDOR: esta pantalla manda la fecha a
 * `preAltas.crear` y guarda el token que le devuelve. El `esMenorDeEdad` de
 * aquí abajo solo sirve para ir mostrando los campos del tutor mientras se
 * escribe; no es lo que determina nada.
 */
function FiltroEdad() {
  const navigate = useNavigate()
  const crearPreAlta = useMutation(api.preAltas.crear)
  const [fecha, setFecha] = useState('')
  const [tutorNombre, setTutorNombre] = useState('')
  const [tutorEmail, setTutorEmail] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)

  const menor = fecha ? esMenorDeEdad(fecha) : false

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!fecha) {
      e.fecha = m.puerta_fecha_error()
    } else {
      const d = new Date(fecha)
      if (d.getTime() > Date.now()) e.fecha = m.puerta_fecha_futuro()
      else if (d.getUTCFullYear() < 1930) e.fecha = m.puerta_fecha_improbable()
    }
    if (menor) {
      if (!tutorNombre.trim()) e.tutorNombre = m.puerta_tutor_nombre_error()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tutorEmail)) e.tutorEmail = m.puerta_tutor_email_error()
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function continuar(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validar()) return

    setEnviando(true)
    try {
      const { token } = await crearPreAlta({
        fechaNacimiento: fecha,
        tutorNombre: menor ? tutorNombre.trim() : undefined,
        tutorEmail: menor ? tutorEmail.trim().toLowerCase() : undefined,
      })
      guardarTokenPreAlta(token)
      await navigate({ to: '/crear-cuenta' })
    } catch (err) {
      // El servidor revalida todo. Si rechaza, se muestra su mensaje: puede
      // saber cosas que el cliente no, como que la fecha no tiene forma válida.
      setErrores({
        fecha: err instanceof Error ? err.message : m.puerta_fecha_error(),
      })
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.puerta_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.puerta_titulo()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.puerta_lede()}</p>

      <form onSubmit={continuar} noValidate className="mt-8">
        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="nac" className="text-[12.5px] font-medium">
            {m.puerta_fecha_label()} <span className="text-bad">*</span>
          </label>
          <input
            id="nac"
            type="date"
            className="fld-input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            aria-invalid={Boolean(errores.fecha)}
            aria-describedby={errores.fecha ? 'nac-err' : undefined}
            autoComplete="bday"
            required
          />
          {errores.fecha && (
            <p id="nac-err" className="text-[11.5px] text-bad">
              {errores.fecha}
            </p>
          )}
        </div>

        {menor && (
          <section className="nota mb-5">
            <b className="mb-1.5 block font-disp text-[14.5px]">{m.puerta_menor_titulo()}</b>
            <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
              {m.puerta_menor_texto()}
            </p>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="tn" className="text-[12.5px] font-medium">
                {m.puerta_tutor_nombre()} <span className="text-bad">*</span>
              </label>
              <input
                id="tn"
                className="fld-input"
                value={tutorNombre}
                onChange={(e) => setTutorNombre(e.target.value)}
                aria-invalid={Boolean(errores.tutorNombre)}
                autoComplete="off"
              />
              {errores.tutorNombre && (
                <p className="text-[11.5px] text-bad">{errores.tutorNombre}</p>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <label htmlFor="te" className="text-[12.5px] font-medium">
                {m.puerta_tutor_email()} <span className="text-bad">*</span>
              </label>
              <input
                id="te"
                type="email"
                className="fld-input"
                value={tutorEmail}
                onChange={(e) => setTutorEmail(e.target.value)}
                aria-invalid={Boolean(errores.tutorEmail)}
                autoComplete="off"
              />
              <p className="text-[11.5px] text-soft">{m.puerta_tutor_ayuda()}</p>
              {errores.tutorEmail && <p className="text-[11.5px] text-bad">{errores.tutorEmail}</p>}
            </div>
          </section>
        )}

        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? m.comun_cargando() : m.comun_continuar()}
        </button>
      </form>
    </main>
  )
}
