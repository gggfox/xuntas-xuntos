import { Link } from '@tanstack/react-router'
import * as m from '../../paraglide/messages.js'
import { can, type Permission } from '../../lib/permissions'
import type { Role } from '../../lib/permissions'
import CycleSelect from './CycleSelect'

type Props = {
  roles: readonly Role[]
  children: React.ReactNode
}

// registros comes first: it is where a reviewer is meant to land. atletas
// is where a coach lands, since it is the only tab they have.
const NAV: ReadonlyArray<{
  to: '/administracion/registros' | '/administracion/atletas' | '/administracion/equipo' | '/administracion/periodos'
  label: () => string
  /** Any one of these opens the tab. */
  needs: readonly Permission[]
}> = [
  { to: '/administracion/registros', label: m.admin_nav_registrations, needs: ['review_registrations'] },
  { to: '/administracion/atletas', label: m.admin_nav_athletes, needs: ['view_assigned_athletes', 'view_all_athletes'] },
  { to: '/administracion/equipo', label: m.admin_nav_staff, needs: ['view_staff'] },
  { to: '/administracion/periodos', label: m.admin_nav_cycles, needs: ['manage_cycles'] },
]

/** Whether this account opens the athletes tab, by the same rule the nav uses. */
export function canSeeAthletes(roles: readonly Role[]): boolean {
  return can(roles, 'view_assigned_athletes') || can(roles, 'view_all_athletes')
}

/**
 * The frame every admin page sits in: one strip across the top — the
 * heading pattern from BRAND.md at a smaller size, a sub-nav that only
 * lists what this account may open, and the period being looked at — and
 * the page underneath, running the width of the window.
 *
 * It used to be the 900px reading column with the heading stacked above the
 * nav. On a laptop that put a nine-column table between two empty margins
 * with its names wrapping onto two lines. A wider column alone was tried
 * (BRAND.md's own 1240) and so was a side rail; the strip won because it
 * spends the least height on chrome and leaves the whole width to the
 * table, which is the only thing on these pages that needs it. The
 * decision is in docs/DECISIONS.md; the pages that are reading rather than
 * tables cap their own width inside this frame.
 *
 * The routes guard themselves too — this is what to draw, not what to
 * allow.
 */
export default function AdminShell({ roles, children }: Props) {
  const links = NAV.filter((n) => n.needs.some((p) => can(roles, p)))
  return (
    <main className="col col-1800 pt-[22px] pb-[90px] lg:pb-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line pb-3">
        <div className="pr-4">
          <p className="eyebrow">{m.admin_eyebrow()}</p>
          <h1 className="h-display mt-[3px] text-[22px]">{m.admin_title()}</h1>
        </div>
        {links.length > 0 && (
          <>
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
            <div className="ml-auto">
              <CycleSelect />
            </div>
          </>
        )}
      </div>
      {children}
    </main>
  )
}
