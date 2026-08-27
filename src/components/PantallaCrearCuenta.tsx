import { SignUp } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import * as m from '../paraglide/messages.js'
import { leerPreAlta, type PreAlta } from '../lib/preAlta'
import { apariencaClerk } from '../lib/clerkApariencia'

export default function PantallaCrearCuenta() {
  const [preAlta, setPreAlta] = useState<PreAlta | null | undefined>(undefined)

  // sessionStorage no existe en el servidor; se lee tras hidratar.
  useEffect(() => setPreAlta(leerPreAlta()), [])

  if (preAlta === undefined) {
    return <main className="mx-auto max-w-[560px] px-[22px] py-16 text-soft">{m.comun_cargando()}</main>
  }

  // Sin filtro de edad no se crea cuenta: no sabríamos si hace falta tutor.
  if (preAlta === null) {
    return (
      <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
        <p className="eyebrow">{m.cuenta_eyebrow()}</p>
        <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.puerta_titulo()}</h1>
        <p className="mt-3 font-light text-soft">{m.puerta_lede()}</p>
        <Link to="/empezar" className="btn mt-6 inline-block no-underline">
          {m.comun_continuar()}
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.cuenta_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.cuenta_titulo()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.cuenta_lede()}</p>
      <p className="mt-2 max-w-[52ch] text-[13px] font-light text-soft">{m.cuenta_sin_contrasena()}</p>

      <div className="mt-8">
        <SignUp
          appearance={apariencaClerk}
          // Viaja con el alta y lo levanta el webhook `user.created`.
          unsafeMetadata={{
            fechaNacimiento: preAlta.fechaNacimiento,
            ...(preAlta.tutorNombre ? { tutorNombre: preAlta.tutorNombre } : {}),
            ...(preAlta.tutorEmail ? { tutorEmail: preAlta.tutorEmail } : {}),
          }}
          signInUrl="/entrar"
          forceRedirectUrl="/mi-registro"
        />
      </div>
    </main>
  )
}
