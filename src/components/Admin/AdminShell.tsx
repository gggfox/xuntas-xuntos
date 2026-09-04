import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import { can, type Permission } from '../../lib/permissions'
import type { Role } from '../../lib/permissions'

type Props = {
  roles: readonly Role[]
  children: React.ReactNode
}

// registros and convocatorias join this list with their plans.
const NAV: ReadonlyArray<{ to: '/administracion/equipo'; label: () => string; needs: Permission }> = [
  { to: '/administracion/equipo', label: m.admin_nav_staff, needs: 'view_staff' },
]

/**
 * The frame every admin page sits in: the heading pattern from BRAND.md and
 * a sub-nav that only lists what this account may open. The routes guard
 * themselves too — this is what to draw, not what to allow.
 */
export default function AdminShell({ roles, children }: Props) {
  const links = NAV.filter((n) => can(roles, n.needs))
  return (
    <main className="col pt-[38px] pb-[90px]">
      <p className="eyebrow">{m.admin_eyebrow()}</p>
      <h1 className="h-display mt-[7px] text-[clamp(26px,4.6vw,38px)]">{m.admin_title()}</h1>
      {links.length > 0 && (
        <nav className="mt-6 flex flex-wrap gap-2 border-b border-line pb-3" aria-label={m.admin_title()}>
          {links.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-ctl border border-transparent px-3 py-1.5 font-mono text-[11.5px] tracking-[.08em] uppercase text-soft no-underline hover:text-ink [&.active]:border-line-2 [&.active]:text-ink"
              activeProps={{ className: 'active' }}
            >
              {n.label()}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </main>
  )
}
