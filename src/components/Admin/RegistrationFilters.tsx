import { useId, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { VIEWS, type Filters, type ViewId } from '../../lib/adminViews'
import { SECTIONS_TOTAL } from '../../../convex/lib/decisionRules'
import { useModal } from '../../hooks/useModal'

type Props = { value: Filters; onChange: (next: Filters) => void; lockStatus?: boolean; view: ViewId }

type Option = { v: string; t: string }

/** Which of the three arrangements a control is drawn in; see `RegistrationFilters`. */
type Layout = 'row' | 'panel' | 'stacked'

const LABEL: Record<Layout, string> = {
  row: 'flex items-center gap-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft',
  // Full width with the control pushed to the far edge, so a column of
  // these reads as a list of label/value pairs rather than a ragged bar.
  panel: 'flex w-full items-center justify-between gap-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft',
  stacked: 'block font-mono text-[10.5px] tracking-[.12em] uppercase text-soft',
}

/**
 * One filter, in whichever arrangement is on screen: `row` and `panel` put
 * the label beside the control — along a bar, or across a column;
 * `stacked` puts it above a full-width one, which is what a thumb wants.
 */
function Field({
  id,
  label,
  value,
  options,
  onChange,
  layout,
}: {
  id: string
  label: string
  value: string
  options: Option[]
  onChange: (v: string) => void
  layout: Layout
}) {
  const row = layout !== 'stacked'
  return (
    <div className={row ? 'contents' : ''}>
      <label htmlFor={id} className={LABEL[layout]}>
        {label}
        {row && (
          <select
            id={id}
            className="fld-input w-auto py-1.5 font-mono text-[11.5px] normal-case tracking-normal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.v} value={o.v}>
                {o.t}
              </option>
            ))}
          </select>
        )}
      </label>
      {!row && (
        <select id={id} className="fld-input mt-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.v} value={o.v}>
              {o.t}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

/**
 * Every view starts from `applyFilters` (`src/lib/adminViews.ts`) so the tab
 * and its own filters never disagree about what "pending" means; this bar
 * only lets a reviewer narrow further. *Pendientes* and *Incompletos* pin
 * their own status, so `lockStatus` hides the one control that would let
 * someone filter a tab into showing rows it was not built to show.
 *
 * Three arrangements, one on screen at a time. From `lg` the controls are
 * a column in the panel beside the table (see the registros route), each
 * label with its control at the far edge. Between `md` and `lg` the page
 * stacks and they are a bar above the table. Below `md` they do not appear
 * at all until they are asked for: wrapped onto four lines they cost about
 * 200px, which on a 375px screen pushes the first row of data off the
 * bottom — the screen would open on its own controls rather than on its
 * answer. Behind one button that counts how many of them are doing
 * something, they cost 32px and stay honest about their own state.
 */
export default function RegistrationFilters({ value, onChange, lockStatus, view }: Props) {
  const [sheet, setSheet] = useState(false)
  const any = m.regs_filter_any()
  const active = activeCount(value)

  const fields = (layout: Layout) => (
    <>
      {!lockStatus && (
        <Field
          id={`f-status-${layout}`}
          layout={layout}
          label={m.regs_filter_status()}
          value={value.status}
          onChange={(status) => onChange({ ...value, status: status as Filters['status'] })}
          options={[
            { v: 'any', t: any },
            { v: 'draft', t: m.status_draft() },
            { v: 'submitted', t: m.status_submitted() },
            { v: 'validated', t: m.status_validated() },
            { v: 'rejected', t: m.status_rejected() },
            { v: 'selected', t: m.status_selected() },
            { v: 'not_selected', t: m.status_not_selected() },
            { v: 'removed', t: m.status_removed() },
          ]}
        />
      )}
      <Field
        id={`f-branch-${layout}`}
        layout={layout}
        label={m.regs_filter_branch()}
        value={value.branch}
        onChange={(branch) => onChange({ ...value, branch: branch as Filters['branch'] })}
        options={[
          { v: 'any', t: any },
          { v: 'womens', t: m.reg_branch_womens() },
          { v: 'mens', t: m.reg_branch_mens() },
        ]}
      />
      <Field
        id={`f-guardian-${layout}`}
        layout={layout}
        label={m.regs_filter_guardian()}
        value={value.guardian}
        onChange={(guardian) => onChange({ ...value, guardian: guardian as Filters['guardian'] })}
        options={[
          { v: 'any', t: any },
          { v: 'pending', t: m.regs_guardian_pending() },
          { v: 'ok', t: m.regs_guardian_ok() },
        ]}
      />
      <Field
        id={`f-sections-${layout}`}
        layout={layout}
        label={m.regs_filter_sections()}
        value={String(value.minSections)}
        onChange={(n) => onChange({ ...value, minSections: Number(n) })}
        options={Array.from({ length: SECTIONS_TOTAL + 1 }, (_, i) => ({ v: String(i), t: String(i) }))}
      />
      <Field
        id={`f-notice-${layout}`}
        layout={layout}
        label={m.regs_filter_notice()}
        value={value.notice}
        onChange={(notice) => onChange({ ...value, notice: notice as Filters['notice'] })}
        options={[
          { v: 'any', t: any },
          { v: 'not_sent', t: m.notice_not_sent() },
          { v: 'sent', t: m.notice_sent() },
          { v: 'delivered', t: m.notice_delivered() },
          { v: 'bounced', t: m.notice_bounced() },
        ]}
      />
    </>
  )

  return (
    <>
      <div className="mt-4 md:hidden">
        <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="dialog" onClick={() => setSheet(true)}>
          {active > 0 ? m.regs_filters_active({ n: active }) : m.regs_filters()}
        </button>
      </div>

      <div className="mt-4 hidden flex-wrap items-center gap-4 md:flex lg:hidden">{fields('row')}</div>

      <div className="mt-4 hidden gap-4 lg:grid">{fields('panel')}</div>

      {sheet && (
        <FilterSheet onClose={() => setSheet(false)} onClear={() => onChange(VIEWS[view].filters)}>
          {fields('stacked')}
        </FilterSheet>
      )}
    </>
  )
}

/** How many controls are narrowing anything, for the button's own badge. */
function activeCount(f: Filters): number {
  return (
    (f.status === 'any' ? 0 : 1) +
    (f.branch === 'any' ? 0 : 1) +
    (f.guardian === 'any' ? 0 : 1) +
    (f.minSections > 0 ? 1 : 0) +
    (f.notice === 'any' ? 0 : 1)
  )
}

/**
 * The controls as a sheet off the bottom edge, which is where a thumb is.
 *
 * A native `<dialog>` like the other two, so Escape, the focus trap and the
 * inert page behind it are the browser's; `useModal` adds the backdrop
 * dismissal the platform does not give a modal dialog. It is square along
 * the bottom because it is against the bottom — the radius comes back at
 * `md`, where it is centred and has an edge on every side again.
 *
 * *Listo* only closes: every control writes straight through to the table,
 * so there is nothing here to apply. It exists because a sheet needs a way
 * out that is not the browser's own, and because a reader who has just
 * chosen something wants to say so.
 */
function FilterSheet({
  children,
  onClose,
  onClear,
}: {
  children: React.ReactNode
  onClose: () => void
  onClear: () => void
}) {
  const { close, dialogProps } = useModal(onClose)
  const titleId = useId()
  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className="card mx-auto mt-auto mb-0 w-full max-w-[560px] rounded-b-none px-[22px] pt-[19px] pb-[26px] md:my-auto md:rounded-b-xt"
    >
      <b id={titleId} className="block font-disp text-[16px]">
        {m.regs_filters()}
      </b>
      <div className="mt-4 grid gap-3.5">{children}</div>
      <div className="mt-5 flex gap-3">
        <button type="button" className="btn flex-1" onClick={close}>
          {m.regs_filters_done()}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          {m.regs_filters_clear()}
        </button>
      </div>
    </dialog>
  )
}
