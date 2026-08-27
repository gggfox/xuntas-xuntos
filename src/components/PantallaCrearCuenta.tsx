import { SignUp } from '@clerk/tanstack-react-start'
import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import * as m from '../paraglide/messages.js'
import { getLocale } from '../paraglide/runtime.js'
import { leerTokenPreAlta } from '../lib/preAlta'
import { aparienciaClerk } from '../lib/clerkApariencia'

export default function PantallaCrearCuenta() {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const { pathname } = useLocation()

  // sessionStorage no existe en el servidor; se lee tras hidratar.
  useEffect(() => setToken(leerTokenPreAlta()), [])

  /**
   * ¿Estamos en un paso interno de Clerk (verificación por código, regreso de
   * Google) y no en la pantalla inicial?
   *
   * Importa: si el alta ya va a medias, hay que montar `<SignUp>` aunque no
   * haya token. Antes no se hacía, y quien entraba por Google y volvía sin el
   * sessionStorage aterrizaba en "vuelve a /empezar" en vez de en el callback
   * de Clerk: el alta quedaba colgada sin manera de terminarla.
   *
   * Que falte el token ya no es grave: la cuenta se crea sin fecha de
   * nacimiento y `/mi-registro` la pide antes de dejar enviar nada.
   */
  const enPasoDeClerk = /\/crear-cuenta\/.+/.test(pathname)

  if (token === undefined) {
    return <main className="mx-auto max-w-[560px] px-[22px] py-16 text-soft">{m.comun_cargando()}</main>
  }

  // Sin filtro de edad no se empieza una cuenta: no sabríamos si hace falta
  // tutor. Solo aplica al primer paso — a media alta no se interrumpe.
  if (token === null && !enPasoDeClerk) {
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
          appearance={aparienciaClerk}
          /**
           * Solo el token, que es una referencia opaca a la pre-alta que ya
           * resolvió el servidor. `unsafeMetadata` la puede reescribir el
           * cliente, así que aquí no viaja ningún dato personal ni ninguna
           * decisión: la fecha de nacimiento y si hace falta tutor ya están
           * guardadas en Convex.
           */
          unsafeMetadata={token ? { preAltaToken: token } : {}}
          // Clerk enruta sus pasos internos (OTP, SSO) sobre la URL real del
          // navegador, que lleva el prefijo de idioma. Sin `path` no monta nada.
          routing="path"
          path={`/${getLocale()}/crear-cuenta`}
          signInUrl={`/${getLocale()}/entrar`}
          forceRedirectUrl={`/${getLocale()}/mi-registro`}
        />
      </div>
    </main>
  )
}
