import { Link } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'

/**
 * 404. Pasa más de lo que parece: los enlaces se comparten por WhatsApp y
 * llegan cortados, y el enlace del tutor es largo.
 */
export default function PantallaNoEncontrada() {
  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.marca_ciclo()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(24px,4vw,32px)]">{m.nf_titulo()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.nf_texto()}</p>
      <Link to="/" className="btn mt-7 inline-block no-underline">
        {m.nf_inicio()}
      </Link>
    </main>
  )
}
