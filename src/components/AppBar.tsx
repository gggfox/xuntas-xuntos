import { Show, SignOutButton } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'

/**
 * Cabecera de la app. Tinta sólida, marca amarilla, sin sombras.
 * Es la misma que en portal_xuntas.html — reconocible desde el primer píxel.
 */
export default function AppBar() {
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex max-w-[900px] items-center justify-between gap-4 px-[22px] py-[15px]">
        <Link to="/" className="flex min-w-0 items-center gap-[11px] no-underline">
          <span
            aria-hidden="true"
            className="grid size-[34px] flex-none place-items-center rounded-full bg-yel font-disp text-[18px] font-extrabold text-ink"
          >
            X
          </span>
          <span className="min-w-0">
            <b className="block font-disp text-[16px] leading-[1.15] font-bold">
              {m.marca_nombre()}
            </b>
            <span className="font-mono text-[10px] tracking-[.12em] text-white/50 uppercase">
              {m.marca_ciclo()}
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-[13px]">
          <Show when="signed-in">
            <Link to="/mi-registro" className="text-white/72 no-underline hover:text-white">
              {m.nav_mi_registro()}
            </Link>
            <SignOutButton>
              <button className="font-mono text-[11.5px] tracking-[.06em] text-white/60 hover:text-white">
                {m.nav_salir()}
              </button>
            </SignOutButton>
          </Show>
          <Show when="signed-out">
            <Link to="/entrar" className="text-white/72 no-underline hover:text-white">
              {m.nav_entrar()}
            </Link>
          </Show>
        </nav>
      </div>
    </header>
  )
}
