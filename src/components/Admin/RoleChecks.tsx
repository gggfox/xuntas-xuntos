import * as m from '../../paraglide/messages.js'
import { ROLES, type Role } from '../../lib/permissions'

export const ROLE_LABEL: Record<Exclude<Role, 'athlete'>, () => string> = {
  admin: m.role_admin,
  master_admin: m.role_master_admin,
  coach: m.role_coach,
  finance: m.role_finance,
  health: m.role_health,
}

export function roleName(role: Role): string {
  return role === 'athlete' ? '' : ROLE_LABEL[role]()
}

type Props = {
  idPrefix: string
  value: readonly Role[]
  onChange: (next: Role[]) => void
  disabled?: boolean
}

/** The staff roles as checkboxes. `athlete` is not offered: it is not a job. */
export default function RoleChecks({ idPrefix, value, onChange, disabled }: Props) {
  const staffRoles = ROLES.filter((r): r is Exclude<Role, 'athlete'> => r !== 'athlete')
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {staffRoles.map((role) => {
        const id = `${idPrefix}-${role}`
        const checked = value.includes(role)
        return (
          <label key={role} htmlFor={id} className="flex items-center gap-2 text-[13px]">
            <input
              id={id}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...value, role] : value.filter((r) => r !== role),
                )
              }
            />
            {ROLE_LABEL[role]()}
          </label>
        )
      })}
    </div>
  )
}
