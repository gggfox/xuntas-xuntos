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
      <select className="fld-input w-auto py-1.5 font-mono text-[11.5px]" value={cycle ?? ''} onChange={(e) => setCycle(e.target.value)}>
        {cycles.map((c) => (
          <option key={c.cycle} value={c.cycle}>
            {c.cycle}{c.isActive ? ` · ${m.cycles_active()}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
