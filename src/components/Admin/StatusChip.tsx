import * as m from '../../paraglide/messages.js'
import Pill, { type PillTone } from '../Pill'
import type { NoticeStatus, RegistrationStatus } from '../../../convex/lib/decisionRules'

/**
 * Three small readouts the table repeats on every row: the registration's
 * own status, whether its decision email has gone out, and whether a minor's
 * guardian has confirmed. `Pill` is the one chip component in the app — this
 * file only decides which word and which tone each state gets, never its
 * own class list. `brand` (the screen's one solid yellow) is spent on the
 * batch-send button, so no state here reaches for it.
 */

const STATUS: Record<RegistrationStatus, { label: () => string; tone: PillTone }> = {
  draft: { label: m.status_draft, tone: 'neutral' },
  submitted: { label: m.status_submitted, tone: 'warn' },
  validated: { label: m.status_validated, tone: 'ok' },
  rejected: { label: m.status_rejected, tone: 'bad' },
  selected: { label: m.status_selected, tone: 'ok' },
  not_selected: { label: m.status_not_selected, tone: 'neutral' },
}

export function StatusChip({ status }: { status: RegistrationStatus }) {
  const s = STATUS[status]
  return <Pill tone={s.tone}>{s.label()}</Pill>
}

const NOTICE: Record<NoticeStatus, { label: () => string; tone: PillTone }> = {
  not_sent: { label: m.notice_not_sent, tone: 'warn' },
  sent: { label: m.notice_sent, tone: 'neutral' },
  delivered: { label: m.notice_delivered, tone: 'ok' },
  bounced: { label: m.notice_bounced, tone: 'bad' },
}

/** `null` before any decision carries a notice at all — nothing to report yet. */
export function NoticeChip({ notice }: { notice: NoticeStatus | null }) {
  if (!notice) return <span className="text-soft">{m.notice_none()}</span>
  const n = NOTICE[notice]
  return <Pill tone={n.tone}>{n.label()}</Pill>
}

export function GuardianChip({ required, confirmed }: { required: boolean; confirmed: boolean }) {
  if (!required) return <Pill>{m.regs_guardian_na()}</Pill>
  return confirmed ? <Pill tone="ok">{m.regs_guardian_ok()}</Pill> : <Pill tone="bad">{m.regs_guardian_pending()}</Pill>
}
