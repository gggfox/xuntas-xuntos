import { Show, useUser } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import FormularioRegistro from '../components/FormularioRegistro'
import { paraEnviar, registroVacio, type DatosRegistro } from '../lib/formulario'
import { FECHA_REVISION } from '../lib/ciclo'
import { esMenorDeEdad } from '../lib/preAlta'

export const Route = createFileRoute('/mi-registro')({
  component: MiRegistro,
})

function MiRegistro() {
  return (
    <>
      <Show when="signed-out">
        <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
          <h1 className="h-display text-[clamp(26px,4.6vw,36px)]">{m.nav_entrar()}</h1>
          <p className="mt-3 font-light text-soft">{m.cuenta_sin_contrasena()}</p>
          <Link to="/entrar" className="btn mt-6 inline-block no-underline">
            {m.nav_entrar()}
          </Link>
        </main>
      </Show>
      <Show when="signed-in">
        <Panel />
      </Show>
    </>
  )
}

function Panel() {
  const { user } = useUser()
  const estado = useQuery(api.users.miEstado)
  const mio = useQuery(api.registros.mio)
  const guardarBorrador = useMutation(api.registros.guardarBorrador)
  const enviarRegistro = useMutation(api.registros.enviar)

  /**
   * Estables a propósito. Estas dos van como dependencias del efecto de
   * autoguardado; si se recrearan en cada render, cada escritura reiniciaría el
   * temporizador y el formulario se guardaría solo, en ciclo.
   */
  const alGuardarBorrador = useCallback(
    (d: DatosRegistro) => {
      void guardarBorrador({ datos: paraEnviar(d) })
    },
    [guardarBorrador],
  )

  const alEnviar = useCallback(
    async (d: DatosRegistro) => {
      const r = await enviarRegistro({ datos: paraEnviar(d) })
      return r.ok ? [] : r.errores
    },
    [enviarRegistro],
  )

  // Convex devuelve undefined mientras la consulta viaja.
  if (estado === undefined || mio === undefined) {
    return <Marco>{m.comun_cargando()}</Marco>
  }

  // null significa que Convex no encontró al usuario. Pasa unos segundos
  // después del alta, mientras aterriza el webhook `user.created`. Antes esto
  // mostraba "Cargando…" para siempre y no había forma de saber si el webhook
  // estaba mal configurado o solo iba tarde. Ahora se dice qué está pasando.
  if (estado === null || mio === null) {
    return <MarcoSincronizando />
  }

  /**
   * La cuenta existe pero no sabemos su edad: se creó sin una pre-alta válida
   * (el caso real es el rodeo por Google, donde se puede perder el token).
   *
   * Se pide antes de dejar tocar el formulario. No se asume mayoría de edad:
   * asumirla era justo el hueco por el que una persona menor podía registrarse
   * sin que nunca se le pidiera autorización a su tutor.
   */
  if (!estado.cuenta.edadDeclarada) {
    return <PasoFechaNacimiento />
  }

  const inicial: DatosRegistro = mio.registro
    ? {
        persona: mio.registro.persona,
        academico: mio.registro.academico,
        deportivo: mio.registro.deportivo,
        resultados: mio.registro.resultados,
        rankings: mio.registro.rankings,
        calendario: mio.registro.calendario,
        cartaMotivos: mio.registro.cartaMotivos,
        confirmaciones: mio.registro.confirmaciones,
      }
    : registroVacio({
        nombre: user?.fullName ?? '',
        email: user?.primaryEmailAddress?.emailAddress ?? '',
      })

  const yaEnviado = mio.registro?.estado === 'enviado' || mio.registro?.estado === 'validado'

  return (
    <main className="mx-auto max-w-[900px] px-[22px] pt-[38px] pb-[90px]">
      <p className="eyebrow">{m.reg_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.reg_titulo()}</h1>

      <EstadoCuenta estado={estado} yaEnviado={yaEnviado} />

      {estado.tutor.requerido && !estado.tutor.confirmado && <AvisoTutor />}

      <div className="mt-9">
        <FormularioRegistro
          inicial={inicial}
          editable={mio.editable}
          yaEnviado={yaEnviado}
          onGuardarBorrador={alGuardarBorrador}
          onEnviar={alEnviar}
        />
      </div>
    </main>
  )
}

/**
 * Los tres ejes de estado, visibles a la vez. La persona que llena esto
 * necesita saber en un vistazo qué le falta y qué depende de alguien más.
 */
function EstadoCuenta({
  estado,
  yaEnviado,
}: {
  estado: NonNullable<ReturnType<typeof useQuery<typeof api.users.miEstado>>>
  yaEnviado: boolean
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <span className={estado.cuenta.emailVerificado ? 'chip chip-ok' : 'chip chip-warn'}>
        {estado.cuenta.emailVerificado ? 'Correo verificado' : 'Falta verificar correo'}
      </span>
      {estado.tutor.requerido && (
        <span className={estado.tutor.confirmado ? 'chip chip-ok' : 'chip chip-bad'}>
          {estado.tutor.confirmado ? 'Tutor autorizó' : 'Falta autorización del tutor'}
        </span>
      )}
      <span className={yaEnviado ? 'chip chip-ok' : 'chip'}>
        {yaEnviado ? 'Registro enviado' : 'Borrador'}
      </span>
    </div>
  )
}

/**
 * Aviso del tutor. Es lo más ruidoso de la pantalla a propósito: si no se
 * confirma, la cuenta queda incompleta y lo tiene que resolver una persona.
 */
function AvisoTutor() {
  const reenviar = useMutation(api.tutor.reenviar)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function accion() {
    setOcupado(true)
    try {
      const r = await reenviar({})
      if (r.ok) setMensaje(m.tutor_reenviado())
      // `demasiados` es el tope de envíos por ciclo: ya no es un problema de
      // entrega y esperar cinco minutos no lo va a arreglar.
      else if (r.motivo === 'demasiados') setMensaje(m.tutor_demasiados())
      else setMensaje(m.tutor_espera())
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="nota mt-6 max-w-[62ch] border-bad/40 bg-bad/5">
      <b className="mb-1.5 block font-disp text-[14.5px]">{m.tutor_falta_titulo()}</b>
      <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
        {m.tutor_falta_texto()}
      </p>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost" onClick={accion} disabled={ocupado}>
          {ocupado ? m.comun_cargando() : m.tutor_reenviar()}
        </button>
        {mensaje && <span className="text-[12.5px] text-soft">{mensaje}</span>}
      </div>
    </section>
  )
}

/**
 * Recuperación del filtro de edad para una cuenta que quedó sin fecha.
 *
 * Es el mismo trato que en `/empezar`: la fecha se manda al servidor, el
 * servidor decide si es menor de edad y, si lo es, exige y avisa al tutor. Se
 * puede hacer una sola vez — si se pudiera cambiar después, bastaría con
 * declararse mayor para quitarse al tutor de encima.
 */
function PasoFechaNacimiento() {
  const declarar = useMutation(api.users.declararFechaNacimiento)
  const [fecha, setFecha] = useState('')
  const [tutorNombre, setTutorNombre] = useState('')
  const [tutorEmail, setTutorEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const menor = fecha ? esMenorDeEdad(fecha) : false

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await declarar({
        fechaNacimiento: fecha,
        tutorNombre: menor ? tutorNombre.trim() : undefined,
        tutorEmail: menor ? tutorEmail.trim().toLowerCase() : undefined,
      })
      // No hace falta navegar: `miEstado` es reactiva y esta pantalla se
      // reemplaza sola por el formulario en cuanto la mutation confirma.
    } catch (err) {
      setError(err instanceof Error ? err.message : m.puerta_fecha_error())
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.puerta_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.puerta_titulo()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.edad_falta_texto()}</p>

      <form onSubmit={enviar} noValidate className="mt-8">
        <div className="mb-4 flex flex-col gap-1.5">
          <label htmlFor="nac2" className="text-[12.5px] font-medium">
            {m.puerta_fecha_label()} <span className="text-bad">*</span>
          </label>
          <input
            id="nac2"
            type="date"
            className="fld-input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            autoComplete="bday"
            required
          />
        </div>

        {menor && (
          <section className="nota mb-5">
            <b className="mb-1.5 block font-disp text-[14.5px]">{m.puerta_menor_titulo()}</b>
            <p className="m-0 text-[13px] leading-relaxed font-light text-ink-3">
              {m.puerta_menor_texto()}
            </p>
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="tn2" className="text-[12.5px] font-medium">
                {m.puerta_tutor_nombre()} <span className="text-bad">*</span>
              </label>
              <input
                id="tn2"
                className="fld-input"
                value={tutorNombre}
                onChange={(e) => setTutorNombre(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <label htmlFor="te2" className="text-[12.5px] font-medium">
                {m.puerta_tutor_email()} <span className="text-bad">*</span>
              </label>
              <input
                id="te2"
                type="email"
                className="fld-input"
                value={tutorEmail}
                onChange={(e) => setTutorEmail(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[11.5px] text-soft">{m.puerta_tutor_ayuda()}</p>
            </div>
          </section>
        )}

        {error && <p className="mb-3 text-[12.5px] text-bad">{error}</p>}

        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? m.comun_cargando() : m.comun_continuar()}
        </button>
      </form>
    </main>
  )
}

/**
 * La cuenta existe en Clerk pero todavía no en Convex. La consulta es reactiva:
 * en cuanto el webhook inserta al usuario, esta pantalla se reemplaza sola.
 */
function MarcoSincronizando() {
  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.marca_ciclo()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(24px,4vw,32px)]">
        {m.sync_titulo()}
      </h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.sync_texto()}</p>
      <p className="mt-6 text-[12.5px] text-soft">{m.sync_ayuda()}</p>
    </main>
  )
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[900px] px-[22px] pt-[46px] pb-[90px]">
      <p className="text-soft">{children}</p>
      <p className="eyebrow mt-4">
        {m.hecho_revision()} · {FECHA_REVISION}
      </p>
    </main>
  )
}
