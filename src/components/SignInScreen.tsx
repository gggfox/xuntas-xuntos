import { SignIn } from '@clerk/tanstack-react-start'
import * as m from '../paraglide/messages.js'
import { getLocale } from '../paraglide/runtime.js'
import { clerkAppearance } from '../lib/clerkAppearance'

export default function SignInScreen() {
  return (
    <main className="mx-auto max-w-[560px] px-[22px] pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.brand_cycle()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.nav_sign_in()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">{m.account_no_password()}</p>
      <div className="mt-8">
        <SignIn
          appearance={clerkAppearance}
          routing="path"
          path={`/${getLocale()}/entrar`}
          signUpUrl={`/${getLocale()}/empezar`}
          forceRedirectUrl={`/${getLocale()}/mi-registro`}
        />
      </div>
    </main>
  )
}
