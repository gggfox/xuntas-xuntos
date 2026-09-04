import { useState } from 'react'
import * as m from '../../paraglide/messages.js'
import { checkDecision, type Decision, type NoticeStatus, type RegistrationStatus } from '../../../convex/lib/decisionRules'
import type { Permission } from '../../lib/permissions'
import { describeConvexError, errorMessage } from '../../lib/registrationErrors'
import { useDateFormats } from '../DateField/format'
import { NoticeChip, StatusChip } from './StatusChip'

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

const BUTTONS: Array<{ decision: Decision; label: () => string; cls: string }> = [
  { decision: 'validated', label: m.detail_validate, cls: 'btn' },
  { decision: 'rejected', label: m.detail_reject, cls: 'btn btn-ghost hover:border-bad hover:text-bad' },
  { decision: 'selected', label: m.detail_select, cls: 'btn' },
  { decision: 'not_selected', label: m.detail_not_select, cls: 'btn btn-ghost' },
]

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
            {allowed.map((b) => (
              <button key={b.decision} type="button" className={b.cls} disabled={busy} onClick={() => void decide(b.decision)}>
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
          onClick={async () => {
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
          {m.detail_send_rejection()}
        </button>
      )}

      <p className="eyebrow mt-6">{m.detail_log()}</p>
      {log.length === 0 && <p className="mt-1 text-[12.5px] text-soft">{m.detail_log_none()}</p>}
      <ul className="mt-1 grid gap-2">
        {[...log].reverse().map((e, i) => (
          <li key={i} className="text-[12.5px]">
            <span className="font-mono text-[11px] text-soft">
              {m.detail_log_entry({ status: e.status, name: e.byName, when: fmt.full.format(new Date(e.at)) })}
            </span>
            {e.note && <p className="mt-0.5 font-light">{e.note}</p>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
