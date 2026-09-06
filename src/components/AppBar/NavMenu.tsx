import { useEffect, useId, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'

/**
 * The header's links, behind a button, on the screens too narrow to hold
 * them in a row. Above `md` this renders nothing: the bar shows the links
 * itself, and the same elements are handed to both — see `AccountNav`.
 *
 * It knows nothing about what it discloses. The header's links come from
 * Clerk and Convex; keeping that out of here is what lets the disclosure
 * itself be tested without standing either of them up.
 *
 * A panel and not a `<dialog>`, unlike everything else in the app that
 * opens: this drops out of the bar it belongs to and leaves the page under
 * it live and readable. The modal treatment — inert backdrop, trapped focus
 * — would be the browser making a bigger claim on the screen than three
 * links deserve.
 *
 * The panel is mounted whether or not it is open, because a panel React has
 * removed cannot be animated on its way out. `aria-hidden` and `inert` are
 * what close it: unreadable, untabbable, unclickable, and — through
 * `.nav-panel` in `styles.css`, which hangs every transition off that same
 * `aria-hidden` — on screen for as long as it takes to fade. No timers
 * here, and so no state that is neither open nor closed for this component
 * to get wrong.
 */
export default function NavMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  /*
   * Why an effect: dismissal arrives on the document, not on this subtree.
   * Both listeners are bound only while the panel is open, so a closed menu
   * costs the page nothing.
   */
  useEffect(() => {
    if (!open) return
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return
      setOpen(false)
      // Escape is dismissal from the keyboard, so focus has to land
      // somewhere deliberate — the element it was on is about to leave the
      // page. A pointer dismissal is left alone: the reader is already
      // reaching for whatever they clicked.
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

  return (
    <div ref={wrap} className="md:hidden">
      <button
        ref={button}
        type="button"
        aria-label={m.nav_menu()}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="burger inline-flex size-[30px] flex-none items-center justify-center rounded-full text-white/72 transition-colors hover:bg-white/10 hover:text-white"
      >
        {/*
         * Three bars that become the cross, rather than two icons swapped
         * for one another: the button is then showing the reader what the
         * press did, which is the whole of what a control this small can
         * say. Drawn in CSS (`.burger` in `styles.css`) because the shape
         * has to be interpolated, and `aria-expanded` on the button is the
         * only thing that switches it — no second source of open-ness.
         */}
        <span className="burger-box" aria-hidden="true">
          <span className="burger-bar" />
          <span className="burger-bar" />
          <span className="burger-bar" />
        </span>
      </button>
      <div
        id={panelId}
        aria-hidden={!open}
        inert={!open}
        /*
         * `.nav-panel` places it: absolute against the header band,
         * which is the nearest positioned ancestor, so it spans the full
         * width under the bar rather than hanging off this button. The
         * motion lives there too — opacity and a short rise, with the
         * rows following one another in.
         *
         * The rows are styled from out here rather than at the link:
         * these are the very same elements the wide bar renders inline,
         * and only their surroundings should decide they are now
         * full-width targets a thumb can hit.
         */
        className="nav-panel border-t border-white/10 bg-chrome px-[22px] pb-3 [&_a]:block [&_a]:py-3 [&_a]:text-[15px] [&_button]:block [&_button]:w-full [&_button]:py-3 [&_button]:text-left [&_button]:text-[13px]"
        // Closing on navigation, without knowing the router: the page
        // swaps underneath a header that never unmounts, so nothing else
        // would put the panel away and the reader would arrive at the new
        // page still behind it.
        onClick={(ev) => {
          if ((ev.target as HTMLElement).closest('a, button')) setOpen(false)
        }}
      >
        {children}
      </div>
    </div>
  )
}
