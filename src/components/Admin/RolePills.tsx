import { useEffect, useId, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'
import Pill from '../Pill'
import { roleName } from './RoleChecks'
import type { Role } from '../../lib/permissions'

/** Kept in step with `.pop`'s `max-width` so the clamp below can do its sum. */
const PANEL_W = 220

/**
 * The roles a row carries: the first one, and the rest behind a `+N`.
 *
 * All of them used to be listed in the cell. Three roles wrap to a second
 * line, and a table where some rows are two lines tall and others are one
 * shifts every column's rhythm depending on who happens to be on the team
 * that week. One pill is a fixed height; the rest are one gesture away.
 *
 * That gesture is both hover and press, because half the people who open
 * this screen do it from a tablet on the side of a court, where there is no
 * hover at all. Press is the one that has to work, so it is a real
 * `<button aria-expanded>` — hover is the shortcut a mouse gets on top.
 */
export default function RolePills({ roles }: { roles: readonly Role[] }) {
  const [first, ...rest] = roles
  if (!first) return null
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Pill>{roleName(first)}</Pill>
      {rest.length > 0 && <MorePill roles={rest} />}
    </span>
  )
}

function MorePill({ roles }: { roles: readonly Role[] }) {
  const [open, setOpen] = useState(false)
  /* Viewport coordinates, measured when the panel opens. See `place`. */
  const [at, setAt] = useState({ top: 0, left: 0 })
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  /**
   * The panel is `position: fixed` and placed from a measurement rather than
   * flowed under the button, because the table sits in a `.card` that scrolls
   * sideways — and an `overflow` box clips what grows out of it. A fixed box
   * is laid out against the viewport, so it escapes that clip; the price is
   * that it does not follow the page, which is why scrolling closes it below.
   */
  function place() {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8)) })
  }

  function show() {
    place()
    setOpen(true)
  }

  /* Escape, a press elsewhere, and any scroll or resize all dismiss it.

     Why an effect: these are subscriptions on `document` and `window`, which
     exist outside React and have to be torn down again. They are only
     attached while the panel is up — a listener per closed popover, on a
     table with thirty rows, is thirty listeners doing nothing. */
  useEffect(() => {
    if (!open) return
    function onKey(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return
      setOpen(false)
      btn.current?.focus()
    }
    function onDown(ev: Event) {
      const t = ev.target as Node
      if (btn.current?.contains(t) || panel.current?.contains(t)) return
      setOpen(false)
    }
    function dismiss() {
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    // Capture: the scroll that matters is the card's own sideways one, and a
    // scroll event on an element does not bubble up to the window.
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open])

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="chip chip-more"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={m.staff_roles_more({ n: roles.length })}
        // Mouse only. A tap fires `pointerenter` too, and letting it through
        // would open the panel on the way in and let the click that follows
        // shut it again — a tap that visibly does nothing.
        onPointerEnter={(ev) => ev.pointerType === 'mouse' && show()}
        onPointerLeave={(ev) => ev.pointerType === 'mouse' && setOpen(false)}
        onClick={() => (open ? setOpen(false) : show())}
      >
        +{roles.length}
      </button>
      {open && (
        <span
          ref={panel}
          id={panelId}
          role="group"
          aria-label={m.staff_col_roles()}
          className="pop"
          style={{ top: at.top, left: at.left }}
        >
          {roles.map((r) => (
            <Pill key={r}>{roleName(r)}</Pill>
          ))}
        </span>
      )}
    </>
  )
}
