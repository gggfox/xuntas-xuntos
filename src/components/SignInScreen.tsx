import { SignIn } from '@clerk/tanstack-react-start'
import * as m from '../paraglide/messages.js'
import { localizeHref } from '../paraglide/runtime.js'
import { clerkAppearance } from '../lib/clerkAppearance'
import { useThemeContext } from './ThemeProvider'
import { useActiveCycle } from '../hooks/useActiveCycle'

export default function SignInScreen() {
  const { resolved } = useThemeContext()
  const c = useActiveCycle()
  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      {c && <p className="eyebrow">{m.brand_cycle({ cycle: c.cycle })}</p>}
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.nav_sign_in()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.account_no_password()}</p>
      <div className="mt-8">
        <SignIn
          appearance={clerkAppearance(resolved)}
          routing="path"
          path={localizeHref('/entrar')}
          signUpUrl={localizeHref('/empezar')}
          forceRedirectUrl={localizeHref('/mi-registro')}
        />
      </div>
    </main>
  )
}
