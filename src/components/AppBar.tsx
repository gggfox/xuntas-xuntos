import { Show, SignOutButton } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import * as m from '../paraglide/messages.js'

/**
 * App header. Solid ink, yellow brand mark, no shadows.
 * It is the same one as in portal_xuntas.html — recognizable from the first pixel.
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
              {m.brand_name()}
            </b>
            <span className="font-mono text-[10px] tracking-[.12em] text-white/50 uppercase">
              {m.brand_cycle()}
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-[13px]">
          <Show when="signed-in">
            <Link to="/mi-registro" className="text-white/72 no-underline hover:text-white">
              {m.nav_my_registration()}
            </Link>
            <SignOutButton>
              <button className="font-mono text-[11.5px] tracking-[.06em] text-white/60 hover:text-white">
                {m.nav_sign_out()}
              </button>
            </SignOutButton>
          </Show>
          <Show when="signed-out">
            <Link to="/entrar" className="text-white/72 no-underline hover:text-white">
              {m.nav_sign_in()}
            </Link>
          </Show>
        </nav>
      </div>
    </header>
  )
}
