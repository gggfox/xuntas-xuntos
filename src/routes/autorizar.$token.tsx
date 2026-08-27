import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'

export const Route = createFileRoute('/autorizar/$token')({
  component: Autorizar,
})

/**
 * Pantalla del tutor. Sin sesión: quien abre el enlace no tiene cuenta y no
 * debe tener que crear una. El token es la credencial.
 */
function Autorizar() {
  const { token } = Route.useParams()
  const solicitud = useQuery(api.tutor.verSolicitud, { token })
  const confirmar = useMutation(api.tutor.confirmar)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function autorizar() {
    setEnviando(true)
    try {
      const r = await confirmar({
        token,
        agente: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : undefined,
      })
      setResultado(r.motivo)
    } finally {
      setEnviando(false)
    }
  }

  if (solicitud === undefined) {
    return <Marco>{m.comun_cargando()}</Marco>
  }

  const estado = resultado ?? solicitud.estado

  if (estado === 'confirmado' || estado === 'ya_confirmado') {
    return (
      <Marco titulo={estado === 'confirmado' ? m.autorizar_ok_titulo() : m.autorizar_ya_titulo()}>
        <p className="font-light text-soft">
          {estado === 'confirmado' ? m.autorizar_ok_texto() : m.autorizar_ya_texto()}
        </p>
      </Marco>
    )
  }

  if (estado === 'vencido') {
    return (
      <Marco titulo={m.autorizar_vencido_titulo()}>
        <p className="font-light text-soft">{m.autorizar_vencido_texto()}</p>
      </Marco>
    )
  }

  if (estado === 'invalido') {
    return (
      <Marco titulo={m.autorizar_invalido_titulo()}>
        <p className="font-light text-soft">{m.autorizar_invalido_texto()}</p>
      </Marco>
    )
  }

  return (
    <Marco titulo={m.autorizar_titulo()}>
      <p className="font-light text-soft">
        <b className="font-medium text-ink">{solicitud.atletaNombre}</b> se registró a la{' '}
        {m.marca_ciclo()} del Programa de Desarrollo de {m.marca_nombre()} y te señaló como su
        padre, madre o tutor.
      </p>
      <p className="mt-3 font-light text-soft">
        Como es menor de edad, necesitamos tu autorización para crear su cuenta y tratar sus datos.
        No hay ningún documento que cargar.
      </p>
      <button className="btn mt-7" onClick={autorizar} disabled={enviando}>
        {enviando ? m.comun_cargando() : m.autorizar_confirmar()}
      </button>
    </Marco>
  )
}

function Marco({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.autorizar_eyebrow()}</p>
      {titulo && <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,36px)]">{titulo}</h1>}
      <div className="mt-5">{children}</div>
    </main>
  )
}
