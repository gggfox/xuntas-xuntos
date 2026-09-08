import * as m from '../../paraglide/messages.js'
import type { NotificationKind } from '../../../convex/lib/notificationRules'
import { useDateFormats } from '../DateField/format'

export type NotificationView = {
  _id: string
  kind: NotificationKind
  userId: string
  athleteId: string
  entryId?: string
  createdAt: number
  readAt?: number
  actorName: string
  athleteName: string
  entryTitle?: string
}

/**
 * The sentence one notification reads as. Who it is for changes the
 * wording: the athlete is told about "tu entrada", the staff about the
 * athlete by name. The names come resolved from the server; a deleted
 * entry leaves the title blank and the sentence still stands.
 */
export function sentenceFor(n: NotificationView): string {
  const forAthlete = n.userId === n.athleteId
  const title = n.entryTitle ?? m.detail_empty()
  switch (n.kind) {
    case 'entry_comment':
      return m.notif_entry_comment({ actor: n.actorName, title })
    case 'entry_reply':
      return m.notif_entry_reply({ athlete: n.athleteName, title })
    case 'general_comment':
      return m.notif_general_comment({ actor: n.actorName })
    case 'general_reply':
      return m.notif_general_reply({ athlete: n.athleteName })
    case 'entry_created':
      return m.notif_entry_created({ athlete: n.athleteName, title })
    case 'assignment_created':
      return forAthlete ? m.notif_assignment_created_athlete() : m.notif_assignment_created_staff({ athlete: n.athleteName })
    case 'assignment_ended':
      return forAthlete ? m.notif_assignment_ended_athlete() : m.notif_assignment_ended_staff({ athlete: n.athleteName })
  }
}

type Props = {
  n: NotificationView
  onOpen: (n: NotificationView) => void
  /** Compact for the bell's panel; roomy for the full list. */
  dense?: boolean
}

/** One row. A button, not a link: opening marks it read before it goes anywhere. */
export default function NotificationItem({ n, onOpen, dense = false }: Props) {
  const fmt = useDateFormats()
  const unread = n.readAt === undefined
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      aria-current={unread ? 'true' : undefined}
      className={`block w-full rounded-ctl text-left ${dense ? 'px-2 py-2' : 'px-[21px] py-[15px]'} ${unread ? 'bg-yel-s' : ''} hover:bg-wash`}
    >
      <span className={`block ${dense ? 'text-[12.5px]' : 'text-[13.5px]'} ${unread ? 'font-medium' : 'font-light'}`}>
        {sentenceFor(n)}
      </span>
      <span className="mt-0.5 block font-mono text-[10.5px] tracking-[.06em] text-soft">
        {fmt.full.format(new Date(n.createdAt))}
      </span>
    </button>
  )
}
