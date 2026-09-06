import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import { can, type Permission } from '../../lib/permissions'
import type { Role } from '../../lib/permissions'
import CycleSelect from './CycleSelect'

type Props = {
  roles: readonly Role[]
  children: React.ReactNode
}

// registros comes first: it is where a reviewer is meant to land.
const NAV: ReadonlyArray<{
  to: '/administracion/registros' | '/administracion/equipo' | '/administracion/convocatorias'
  label: () => string
  needs: Permission
}> = [
  { to: '/administracion/registros', label: m.admin_nav_registrations, needs: 'review_registrations' },
  { to: '/administracion/equipo', label: m.admin_nav_staff, needs: 'view_staff' },
  { to: '/administracion/convocatorias', label: m.admin_nav_cycles, needs: 'manage_cycles' },
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
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <nav className="flex flex-wrap gap-2" aria-label={m.admin_title()}>
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
          <CycleSelect />
        </div>
      )}
      {children}
    </main>
  )
}
