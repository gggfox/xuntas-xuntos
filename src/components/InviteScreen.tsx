import { SignUp } from '@clerk/tanstack-react-start'
import { useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import * as m from '../paraglide/messages.js'
import { localizeHref } from '../paraglide/runtime.js'
import { clerkAppearance } from '../lib/clerkAppearance'
import { roleName } from './Admin/RoleChecks'
import { useThemeContext } from './ThemeProvider'

const CLOSED_TITLE = {
  invalid: m.invite_invalid_title,
  expired: m.invite_expired_title,
  revoked: m.invite_revoked_title,
  accepted: m.invite_accepted_title,
} as const

/**
 * Where an invitation lands. No age gate and no pre-signup: staff are not
 * registrants. The email is prefilled and the webhook redeems the invite by
 * matching it, so a different address signs up as a plain athlete.
 */
export default function InviteScreen() {
  const { token } = useParams({ strict: false }) as { token: string }
  const invite = useQuery(api.staff.getInvite, { token })
  const { resolved } = useThemeContext()

  if (invite === undefined) {
    return <main className="col col-560 py-16 text-soft">{m.common_loading()}</main>
  }

  if (invite.status !== 'pending') {
    return (
      <main className="col col-560 pt-[46px] pb-[90px]">
        <p className="eyebrow">{m.invite_eyebrow()}</p>
        <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,36px)]">{CLOSED_TITLE[invite.status]()}</h1>
        <p className="mt-3 font-light text-soft">{m.invite_closed_text()}</p>
      </main>
    )
  }

  return (
    <main className="col col-560 pt-[46px] pb-[90px]">
      <p className="eyebrow">{m.invite_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.invite_title()}</h1>
      <p className="mt-3 max-w-[52ch] font-light text-soft">
        {m.invite_lede({
          name: invite.invitedByName,
          roles: invite.roles.map(roleName).join(', '),
          email: invite.email,
        })}
      </p>
      <p className="mt-2 max-w-[52ch] text-[13px] font-light text-soft">{m.account_no_password()}</p>
      <div className="mt-8">
        <SignUp
          appearance={clerkAppearance(resolved)}
          initialValues={{ emailAddress: invite.email }}
          // Clerk routes its internal steps (OTP, SSO) on the browser's real
          // URL, which carries the locale prefix. Without `path` nothing
          // mounts — and if `path` disagrees with the URL, Clerk renders an
          // empty box and says nothing. `localizeHref` is what the app's own
          // links and redirects use, so the two cannot drift apart.
          routing="path"
          path={localizeHref(`/invitacion/${token}`)}
          signInUrl={localizeHref('/entrar')}
          forceRedirectUrl={localizeHref('/administracion')}
        />
      </div>
    </main>
  )
}
