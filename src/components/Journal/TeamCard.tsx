import * as m from '../../paraglide/messages.js'
import Pill from '../Pill'
import { roleName } from '../Admin/RoleChecks'
import type { Role } from '../../lib/permissions'

export type TeamMember = { _id: string; name: string; roles: readonly Role[] }

/**
 * Who works with this member: names and roles, read-only. The same card on
 * the athlete's profile, on the staff detail and under the decision panel —
 * assignment itself happens from the staff row, never from here.
 */
export default function TeamCard({ team }: { team: TeamMember[] | undefined }) {
  return (
    <section className="card px-[21px] py-[19px]">
      <p className="eyebrow">{m.team_title()}</p>
      {team === undefined ? (
        <p className="mt-2 text-[12.5px] text-soft">{m.common_loading()}</p>
      ) : team.length === 0 ? (
        <p className="mt-2 text-[12.5px] font-light text-soft">{m.team_none()}</p>
      ) : (
        <ul className="mt-2 grid list-none gap-2 p-0">
          {team.map((t) => (
            <li key={t._id} className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
              <span>{t.name}</span>
              <span className="flex flex-wrap gap-1">
                {t.roles.map((r) => (
                  <Pill key={r}>{roleName(r)}</Pill>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
