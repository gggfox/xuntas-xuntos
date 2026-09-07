import { useEffect, useId, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import Icons from '../Icons'
import NotificationItem, { type NotificationView } from '../Notifications/NotificationItem'

type Props = {
  unread: number
  /** The newest few, read or not. `undefined` while loading. */
  latest: NotificationView[] | undefined
  onOpen: (n: NotificationView) => void
  onMarkAll: () => void
  onSeeAll: () => void
}

/**
 * The bell in the bar: a count, and behind it the latest few. Same
 * disclosure as `AccountMenu` — a panel, not a dialog; mounted whether or
 * not it is open; closed by `aria-hidden` and `inert`. It knows nothing
 * about Convex: the header hands in the rows and takes the presses back,
 * which is what lets the disclosure be tested on its own.
 */
export default function NotificationBell({ unread, latest, onOpen, onMarkAll, onSeeAll }: Props) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    function onPointerDown(ev: MouseEvent) {
      if (!wrap.current?.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const badge = unread > 99 ? '99+' : String(unread)
  const label = unread > 0 ? m.notif_bell_unread({ n: unread }) : m.notif_bell()

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-[30px] items-center justify-center rounded-full text-white/72 hover:text-white"
      >
        <Icons.Bell />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full border border-on-yel bg-yel px-1 font-mono text-[9.5px] leading-[14px] font-semibold text-on-yel"
          >
            {badge}
          </span>
        )}
      </button>
      <div
        id={panelId}
        aria-hidden={!open}
        inert={!open}
        role="group"
        aria-label={m.nav_notifications()}
        className="acct-panel w-[min(360px,calc(100vw-32px))] max-w-none"
        onClick={(ev) => {
          if ((ev.target as HTMLElement).closest('a, button')) setOpen(false)
        }}
      >
        <div className="acct-who flex items-center justify-between gap-3">
          <b className="text-[13px] font-semibold text-ink">{m.nav_notifications()}</b>
          {unread > 0 && (
            <button type="button" className="font-mono text-[10.5px] tracking-[.06em] text-soft hover:text-ink" onClick={onMarkAll}>
              {m.notif_mark_all()}
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {latest === undefined ? (
            <p className="px-2 py-2 text-[12.5px] text-soft">{m.common_loading()}</p>
          ) : latest.length === 0 ? (
            <p className="px-2 py-2 text-[12.5px] font-light text-soft">{m.notif_none()}</p>
          ) : (
            latest.map((n) => <NotificationItem key={n._id} n={n} onOpen={onOpen} dense />)
          )}
        </div>
        <div className="border-t border-line p-1.5">
          <button type="button" className="block w-full rounded-ctl px-2 py-2 text-left text-[12.5px] text-ink hover:bg-wash" onClick={onSeeAll}>
            {m.notif_see_all()}
          </button>
        </div>
      </div>
    </div>
  )
}
