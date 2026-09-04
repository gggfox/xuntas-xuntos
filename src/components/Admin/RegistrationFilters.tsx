import * as m from '../../paraglide/messages.js'
import type { Filters } from '../../lib/adminViews'
import { SECTIONS_TOTAL } from '../../../convex/lib/decisionRules'

type Props = { value: Filters; onChange: (next: Filters) => void; lockStatus?: boolean }

function Select<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: T
  options: Array<{ v: T; t: string }>
  onChange: (v: T) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
      {label}
      <select
        id={id}
        className="fld-input w-auto py-1.5 font-mono text-[11.5px] normal-case tracking-normal"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.t}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Every view starts from `applyFilters` (`src/lib/adminViews.ts`) so the tab
 * and its own filters never disagree about what "pending" means; this bar
 * only lets a reviewer narrow further. *Pendientes* and *Incompletos* pin
 * their own status, so `lockStatus` hides the one control that would let
 * someone filter a tab into showing rows it was not built to show.
 */
export default function RegistrationFilters({ value, onChange, lockStatus }: Props) {
  const any = m.regs_filter_any()
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      {!lockStatus && (
        <Select
          id="f-status"
          label={m.regs_filter_status()}
          value={value.status}
          onChange={(status) => onChange({ ...value, status })}
          options={[
            { v: 'any', t: any },
            { v: 'draft', t: m.status_draft() },
            { v: 'submitted', t: m.status_submitted() },
            { v: 'validated', t: m.status_validated() },
            { v: 'rejected', t: m.status_rejected() },
            { v: 'selected', t: m.status_selected() },
            { v: 'not_selected', t: m.status_not_selected() },
          ]}
        />
      )}
      <Select
        id="f-branch"
        label={m.regs_filter_branch()}
        value={value.branch}
        onChange={(branch) => onChange({ ...value, branch })}
        options={[
          { v: 'any', t: any },
          { v: 'womens', t: m.reg_branch_womens() },
          { v: 'mens', t: m.reg_branch_mens() },
        ]}
      />
      <Select
        id="f-guardian"
        label={m.regs_filter_guardian()}
        value={value.guardian}
        onChange={(guardian) => onChange({ ...value, guardian })}
        options={[
          { v: 'any', t: any },
          { v: 'pending', t: m.regs_guardian_pending() },
          { v: 'ok', t: m.regs_guardian_ok() },
        ]}
      />
      <Select
        id="f-sections"
        label={m.regs_filter_sections()}
        value={String(value.minSections)}
        onChange={(n) => onChange({ ...value, minSections: Number(n) })}
        options={Array.from({ length: SECTIONS_TOTAL + 1 }, (_, i) => ({ v: String(i), t: String(i) }))}
      />
      <Select
        id="f-notice"
        label={m.regs_filter_notice()}
        value={value.notice}
        onChange={(notice) => onChange({ ...value, notice })}
        options={[
          { v: 'any', t: any },
          { v: 'not_sent', t: m.notice_not_sent() },
          { v: 'sent', t: m.notice_sent() },
          { v: 'delivered', t: m.notice_delivered() },
          { v: 'bounced', t: m.notice_bounced() },
        ]}
      />
    </div>
  )
}
