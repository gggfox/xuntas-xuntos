import { Show, useUser } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import FormularioRegistro from '../components/FormularioRegistro'
import { paraEnviar, registroVacio, type DatosRegistro } from '../lib/formulario'
import { FECHA_REVISION } from '../lib/ciclo'

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
          onGuardarBorrador={(d) => {
            void guardarBorrador({ datos: paraEnviar(d) })
          }}
          onEnviar={async (d) => {
            const r = await enviarRegistro({ datos: paraEnviar(d) })
            return r.ok ? [] : r.errores
          }}
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
      setMensaje(r.ok && r.motivo === 'enviado' ? m.tutor_reenviado() : m.tutor_espera())
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
