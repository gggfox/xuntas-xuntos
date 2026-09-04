import { SignUp } from '@clerk/tanstack-react-start'
import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import * as m from '../paraglide/messages.js'
import { localizeHref } from '../paraglide/runtime.js'
import { readPreSignupToken } from '../lib/preSignup'
import { clerkAppearance } from '../lib/clerkAppearance'
import { useThemeContext } from './ThemeProvider'
import { useActiveCycle } from '../hooks/useActiveCycle'

export default function SignUpScreen() {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const { pathname } = useLocation()
  const { resolved } = useThemeContext()
  const cycle = useActiveCycle()

  /**
   * The token: sessionStorage does not exist on the server, so it is read
   * after hydrating.
   *
   * Why an effect: it cannot be computed during the first render, because
   * that render also happens on the server, and it cannot arrive as a prop
   * either — the token is per-tab. This is the post-hydration correction the
   * guideline calls flicker, and its inline-script escape hatch does not fit
   * here: what changes is which of three screens mounts, not one class name a
   * script could patch before React arrives. The loading state below is the
   * price, and it lasts one paint.
   * See `.agents/skills/vercel-react-best-practices/rules/rendering-hydration-no-flicker.md`.
   */
  useEffect(() => setToken(readPreSignupToken()), [])

  /**
   * Are we in an internal Clerk step (code verification, coming back from
   * Google) and not on the initial screen?
   *
   * It matters: if the sign-up is already halfway through, `<SignUp>` must be
   * mounted even without a token. This was not done before, and whoever went
   * in through Google and came back without the sessionStorage landed on
   * "go back to /empezar" instead of on Clerk's callback: the sign-up was
   * left hanging with no way to finish it.
   *
   * A missing token is no longer serious: the account gets created without a
   * birth date and `/mi-registro` asks for it before letting anything be
   * submitted.
   */
  const inClerkStep = /\/crear-cuenta\/.+/.test(pathname)

  if (token === undefined) {
    return <main className="col col-560 py-16 text-soft">{m.common_loading()}</main>
  }

  // Without the age gate no account gets started: we would not know whether a
  // guardian is needed. It only applies to the first step — a sign-up halfway
  // through is not interrupted.
  if (token === null && !inClerkStep) {
    return (
      <main className="col col-560 pt-[46px] pb-[90px]">
        <p className="eyebrow">{m.account_eyebrow()}</p>
        <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.gate_title()}</h1>
        <p className="mt-3 font-light text-soft">{m.gate_lede()}</p>
        <Link to="/empezar" className="btn mt-6 inline-block no-underline">
          {m.common_continue()}
        </Link>
      </main>
    )
  }

  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.account_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.account_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">
        {m.account_lede({ date: cycle?.closesOnText ?? '' })}
      </p>
      <p className="mt-2 max-w-[52ch] text-[13px] font-light text-soft">{m.account_no_password()}</p>

      <div className="mt-8">
        <SignUp
          appearance={clerkAppearance(resolved)}
          /**
           * Only the token, which is an opaque reference to the pre-signup
           * the server already resolved. `unsafeMetadata` can be rewritten
           * by the client, so no personal data and no decision travels
           * here: the birth date and whether a guardian is needed are
           * already stored in Convex.
           */
          unsafeMetadata={token ? { preSignupToken: token } : {}}
          // Clerk routes its internal steps (OTP, SSO) on the browser's real
          // URL, which carries the locale prefix. Without `path` nothing
          // mounts — and if `path` disagrees with the URL, Clerk renders an
          // empty box and says nothing. `localizeHref` is what the app's own
          // links and redirects use, so the two cannot drift apart.
          routing="path"
          path={localizeHref('/crear-cuenta')}
          signInUrl={localizeHref('/entrar')}
          forceRedirectUrl={localizeHref('/mi-registro')}
        />
      </div>
    </main>
  )
}
