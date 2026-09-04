import { useState } from 'react'
import * as m from '../../paraglide/messages.js'
import DateField from '../DateField'
import RangeField from '../DateField/RangeField'
import { validateCycle } from '../../../convex/lib/cycleRules'
import type { CycleInput } from '../../../convex/lib/cycleRules'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'

type Props = {
  initial?: CycleInput
  /** The name is the key; editing an existing row keeps it read-only. */
  lockName?: boolean
  submitLabel: string
  onSubmit: (input: CycleInput) => Promise<void>
  onDone?: () => void
}

/**
 * Create or edit one call for applications: its name, its registration
 * window, and the day results are reviewed. Shared by `CyclesPanel` for both
 * "Nueva convocatoria" and "Editar" — only whether the name is locked and
 * what the submit does differ.
 */
export default function CycleForm({ initial, lockName, submitLabel, onSubmit, onDone }: Props) {
  const [cycle, setCycle] = useState(initial?.cycle ?? '')
  const [opensOn, setOpensOn] = useState(initial?.opensOn ?? '')
  const [closesOn, setClosesOn] = useState(initial?.closesOn ?? '')
  const [reviewOn, setReviewOn] = useState(initial?.reviewOn ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const input = { cycle: cycle.trim(), opensOn, closesOn, reviewOn }
    const problem = validateCycle(input)
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(input)
      onDone?.()
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  /*
   * The card runs the full width of the column so the two calendars can sit
   * beside each other on a desktop: they are read together — the review date
   * only makes sense against the day the window closes — and stacked they
   * push the second one below the fold. The name keeps a reading width of
   * its own; a text box as wide as two calendars is a box nobody can aim at.
   */
  return (
    <form onSubmit={submit} noValidate className="card mt-6 px-[21px] py-[19px]">
      <label htmlFor="cycle-name" className="text-[12.5px] font-medium">
        {m.cycles_name()} <span className="text-bad">*</span>
      </label>
      <input
        id="cycle-name"
        className="fld-input mt-1.5 max-w-[26ch] font-mono tracking-[0.04em]"
        value={cycle}
        onChange={(e) => setCycle(e.target.value)}
        disabled={lockName}
        placeholder="2027-2028"
      />
      <p className="mt-1 mb-5 text-[11.5px] text-soft">{m.cycles_name_help()}</p>

      {/* Top-aligned: the two fields carry different numbers of lines above
          their grids, and centring them would leave the calendars on
          different baselines. */}
      <div className="grid items-start gap-x-7 gap-y-5 lg:grid-cols-2">
        <RangeField
          id="cycle-window"
          label={m.cycles_window()}
          start={opensOn}
          end={closesOn}
          onChange={({ start, end }) => {
            setOpensOn(start)
            setClosesOn(end)
          }}
          min={`${new Date().getUTCFullYear() - 1}-01-01`}
          max={`${new Date().getUTCFullYear() + 5}-12-31`}
        />

        <DateField
          id="cycle-review"
          label={m.cycles_review()}
          req
          value={reviewOn}
          onChange={setReviewOn}
          min={closesOn || undefined}
          max={`${new Date().getUTCFullYear() + 5}-12-31`}
          openAt={closesOn || undefined}
        />
      </div>

      <p className="mt-2 min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
      <button type="submit" className="btn" disabled={busy}>
        {busy ? m.common_loading() : submitLabel}
      </button>
    </form>
  )
}
