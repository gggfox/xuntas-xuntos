import { useEffect, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { checkDecision, type Decision, type NoticeStatus, type RegistrationStatus } from '../../../convex/lib/decisionRules'
import type { Permission } from '../../lib/permissions'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'
import { useDateFormats } from '../DateField/format'
import { NoticeChip, StatusChip, decisionLabel } from './StatusChip'

type LogEntry = { status: Decision; at: number; byName: string; note?: string }

type Props = {
  status: RegistrationStatus
  guardianConfirmed: boolean
  notice: NoticeStatus | null
  permissions: readonly Permission[]
  log: LogEntry[]
  onDecide: (decision: Decision, note: string) => Promise<void>
  onSendRejection: () => Promise<void>
}

/** How long the "confirm send" state stays armed before it reverts on its own. */
const CONFIRM_TIMEOUT_MS = 4000

const BUTTONS: Array<{ decision: Decision; label: () => string }> = [
  { decision: 'validated', label: m.detail_validate },
  { decision: 'rejected', label: m.detail_reject },
  { decision: 'selected', label: m.detail_select },
  { decision: 'not_selected', label: m.detail_not_select },
]

/**
 * Which decisions the policy allows can change with the status and the
 * actor's permissions, so no decision may own `.btn`'s solid yellow by name
 * — a status can legally offer two at once (a master_admin looking at a
 * `not_selected` row may re-validate or re-select it), and both would have
 * claimed the screen's one yellow if the class were pinned per decision.
 * The screen has one yellow, and the first thing offered is what it
 * belongs to: only the first button in the *allowed* list is solid, every
 * button after it is ghost, and rejection keeps its destructive-hover
 * treatment regardless of which slot it lands in.
 */
function classFor(decision: Decision, isPrimary: boolean): string {
  const base = isPrimary ? 'btn' : 'btn btn-ghost'
  return decision === 'rejected' ? `${base} hover:border-bad hover:text-bad` : base
}

/**
 * The buttons are the rules made visible: a button is drawn only if the same
 * `checkDecision` the server runs would let this account press it (ignoring
 * the note, which is asked for on press). Nothing here is the gate.
 */
export default function DecisionPanel({ status, guardianConfirmed, notice, permissions, log, onDecide, onSendRejection }: Props) {
  const fmt = useDateFormats()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // The rejection email is a single, unrecallable send from a bare button —
  // the batch gets a modal because it is deliberate and counted, and one
  // family's email deserves the same deliberateness, not less just because
  // it is one click instead of a dialog's several. A first press only arms
  // the button; it must be pressed again, while still armed, to actually
  // send. The timeout handle lives in a ref rather than state so it can be
  // cleared and reset without a render in between.
  const [confirmingSend, setConfirmingSend] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [])

  function disarmSend() {
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current)
      confirmTimer.current = null
    }
    setConfirmingSend(false)
  }

  const allowed = BUTTONS.filter((b) => {
    const problem = checkDecision({ from: status, to: b.decision, note: 'x', guardianConfirmed, noticeStatus: notice, permissions })
    return problem === null
  })

  async function decide(decision: Decision) {
    const problem = checkDecision({ from: status, to: decision, note, guardianConfirmed, noticeStatus: notice, permissions })
    if (problem) {
      setError(errorMessage(problem))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onDecide(decision, note.trim())
      setNote('')
    } catch (err) {
      setError(describeConvexError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="card px-[21px] py-[19px] lg:sticky lg:top-6">
      <p className="eyebrow">{m.detail_decision()}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusChip status={status} />
        <NoticeChip notice={notice} />
      </div>

      {allowed.length > 0 && (
        <>
          <label htmlFor="decision-note" className="mt-5 block text-[12.5px] font-medium">{m.detail_note()}</label>
          <textarea
            id="decision-note"
            className="fld-input mt-1.5 min-h-[80px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="mt-1 text-[11.5px] text-soft">{m.detail_note_help()}</p>
          <p className="min-h-[1.45em] text-[11.5px] leading-[1.45] text-bad">{error}</p>
          <div className="flex flex-wrap gap-2">
            {allowed.map((b, i) => (
              <button
                key={b.decision}
                type="button"
                className={classFor(b.decision, i === 0)}
                disabled={busy}
                onClick={() => void decide(b.decision)}
              >
                {b.label()}
              </button>
            ))}
          </div>
        </>
      )}

      {status === 'rejected' && notice === 'not_sent' && permissions.includes('send_rejection') && (
        <button
          type="button"
          className="btn btn-ghost mt-4"
          disabled={busy}
          onBlur={disarmSend}
          onClick={async () => {
            // First click only arms the button and starts the revert timer;
            // it does not send. Only a second click, while still armed,
            // sends — and it disarms immediately so a stray third click
            // cannot fire a second email.
            if (!confirmingSend) {
              setConfirmingSend(true)
              confirmTimer.current = setTimeout(() => setConfirmingSend(false), CONFIRM_TIMEOUT_MS)
              return
            }
            disarmSend()
            setBusy(true)
            try {
              await onSendRejection()
            } catch (err) {
              setError(describeConvexError(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          {confirmingSend ? m.detail_send_rejection_confirm() : m.detail_send_rejection()}
        </button>
      )}

      <p className="eyebrow mt-6">{m.detail_log()}</p>
      {log.length === 0 && <p className="mt-1 text-[12.5px] text-soft">{m.detail_log_none()}</p>}
      <ul className="mt-1 grid gap-2">
        {[...log].reverse().map((e, i) => (
          <li key={i} className="text-[12.5px]">
            <span className="font-mono text-[11px] text-soft">
              {m.detail_log_entry({ status: decisionLabel(e.status), name: e.byName || m.detail_empty(), when: fmt.full.format(new Date(e.at)) })}
            </span>
            {e.note && <p className="mt-0.5 font-light">{e.note}</p>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
