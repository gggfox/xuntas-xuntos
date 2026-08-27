import { SignIn } from '@clerk/tanstack-react-start'
import * as m from '../paraglide/messages.js'
import { aparienciaClerk } from '../lib/clerkApariencia'

export default function PantallaEntrar() {
  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.marca_ciclo()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.nav_entrar()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.cuenta_sin_contrasena()}</p>
      <div className="mt-8">
        <SignIn
          appearance={aparienciaClerk}
          signUpUrl="/empezar"
          forceRedirectUrl="/mi-registro"
        />
      </div>
    </main>
  )
}
