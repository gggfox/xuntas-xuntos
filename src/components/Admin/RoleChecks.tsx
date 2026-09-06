import * as m from '../../paraglide/messages.js'
import { PillToggle } from '../Pill'
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
  /** Keeps the keys unique when two of these render at once (a form and a row). */
  idPrefix: string
  /** Names the group of toggles for a screen reader. */
  label: string
  value: readonly Role[]
  onChange: (next: Role[]) => void
  disabled?: boolean
}

/**
 * The staff roles, as pills you press. `athlete` is not offered: it is not a
 * job.
 *
 * A group of toggles rather than a column of checkboxes, because the set is
 * short, closed, and read at a glance — and because the same pill shape
 * shows those roles back in the tables, so choosing one looks like the thing
 * it produces. `role="group"` keeps the five announced as one question.
 */
export default function RoleChecks({ idPrefix, label, value, onChange, disabled }: Props) {
  const staffRoles = ROLES.filter((r): r is Exclude<Role, 'athlete'> => r !== 'athlete')
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {staffRoles.map((role) => (
        <PillToggle
          key={`${idPrefix}-${role}`}
          pressed={value.includes(role)}
          disabled={disabled}
          onToggle={(pressed) =>
            onChange(pressed ? [...value, role] : value.filter((r) => r !== role))
          }
        >
          {ROLE_LABEL[role]()}
        </PillToggle>
      ))}
    </div>
  )
}
