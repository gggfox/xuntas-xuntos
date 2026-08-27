import { Link } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'

/**
 * Lo que se ve cuando algo revienta en el cliente o en el SSR.
 *
 * Sin esto, un error de render dejaba la página en blanco: alguien a media
 * captura, en el celular, sin saber si se guardó su carta de motivos. Lo
 * importante que dice esta pantalla es que el borrador está a salvo, porque
 * suele ser cierto —se autoguarda— y es lo único que la persona se pregunta.
 *
 * El error se manda a la consola con un prefijo estable para poder encontrarlo
 * en los logs de Dokploy.
 */
export default function PantallaError({ error }: { error: Error }) {
  console.error('[ui] error no controlado:', error)

  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.marca_ciclo()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(24px,4vw,32px)]">{m.error_titulo()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.error_texto()}</p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          {m.error_reintentar()}
        </button>
        <Link to="/mi-registro" className="btn btn-ghost no-underline">
          {m.nav_mi_registro()}
        </Link>
      </div>

      {/*
        El mensaje técnico va al final y en voz baja: no le sirve a quien se
        está registrando, pero le ahorra una ida y vuelta a quien reciba el
        correo de soporte con una captura de pantalla.
      */}
      <p className="mt-8 font-mono text-[11px] break-words text-soft">{error.message}</p>
    </main>
  )
}
