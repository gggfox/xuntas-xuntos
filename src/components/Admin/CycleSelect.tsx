import * as m from '../../paraglide/messages.js'
import { useAdminCycle } from '../../hooks/useAdminCycle'

/**
 * The call this admin session is looking at. Hidden until there is more than
 * one call to choose between — a single row is not a choice, and a select
 * with one option only invites a click that does nothing.
 */
export default function CycleSelect() {
  const { cycle, cycles, setCycle } = useAdminCycle()
  if (!cycles || cycles.length < 2) return null
  return (
    <label className="flex items-center gap-2 font-mono text-[10.5px] tracking-[.12em] uppercase text-soft">
      {m.cycles_select_label()}
      {/* Body font, not mono: what this lists is a name now, and mono is the
          product's voice for labels, dates and keys — see docs/BRAND.md. */}
      <select
        className="fld-input w-auto py-1.5 text-[12.5px] normal-case tracking-normal"
        value={cycle ?? ''}
        onChange={(e) => setCycle(e.target.value)}
      >
        {/* The title, not the key: this list is read, and a reader picks a
            call by what it is called rather than by what it is filed as. */}
        {cycles.map((c) => (
          <option key={c.cycle} value={c.cycle}>
            {c.displayTitle}{c.isActive ? ` · ${m.cycles_active()}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
