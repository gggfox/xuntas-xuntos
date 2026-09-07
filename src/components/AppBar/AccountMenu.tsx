import { useEffect, useId, useRef, useState } from 'react'
import * as m from '../../paraglide/messages.js'

type Props = {
  /** What Clerk knows about the account. Any of them may still be missing. */
  name?: string | null
  email?: string | null
  imageUrl?: string | null
  /** The links the panel discloses: the header decides what they are. */
  children: React.ReactNode
}

/**
 * The signed-in account, as a face in the bar, and the two things it can do
 * behind it.
 *
 * Two links and a name were taking up the right third of the header, and
 * none of them said who was signed in. The avatar says that at a glance —
 * the picture Clerk holds, or the initials when there is none — and the
 * panel it opens repeats it in words, since a face alone is not proof to a
 * screen reader or to a shared tablet.
 *
 * It knows nothing about Clerk itself: the header reads the account and
 * hands the pieces in, which is what lets the disclosure be tested without
 * standing a session up. Same shape as `NavMenu`, and for the same reasons
 * — a panel rather than a `<dialog>`, mounted whether or not it is open so
 * the stylesheet can transition it out, and made closed by `aria-hidden`
 * and `inert` rather than by its absence.
 */
export default function AccountMenu({ name, email, imageUrl, children }: Props) {
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

  const who = name?.trim() || email || ''
  const mark = initials(name ?? '') || (email ?? '').slice(0, 1).toUpperCase()

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={who ? `${m.nav_account_menu()}: ${who}` : m.nav_account_menu()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="avatar-btn inline-flex size-[30px] flex-none items-center justify-center overflow-hidden rounded-full bg-white/15 font-mono text-[11px] font-semibold tracking-[.04em] text-white transition-shadow"
      >
        {imageUrl ? (
          // `alt` is empty on purpose: the button already says whose face
          // this is, and a picture that repeated the name would be read
          // twice.
          <img src={imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true">{mark}</span>
        )}
      </button>
      <div
        id={panelId}
        aria-hidden={!open}
        inert={!open}
        role="group"
        aria-label={m.nav_account()}
        className="acct-panel"
        // Closing on navigation, without knowing the router — see NavMenu.
        onClick={(ev) => {
          if ((ev.target as HTMLElement).closest('a, button')) setOpen(false)
        }}
      >
        {(name || email) && (
          <div className="acct-who">
            {name && <b className="block truncate text-[13px] font-semibold text-ink">{name}</b>}
            {email && <span className="block truncate text-[12px] text-soft">{email}</span>}
          </div>
        )}
        {/*
          * The rows are the very same elements the narrow bar lays over ink,
          * and they arrive dressed for it — white text, and mono for the
          * sign-out. On this card that is invisible in light mode, so the
          * wrapper overrules them; arbitrary variants because Tailwind's
          * utilities outrank anything `.acct-links` could say in the
          * components layer. Layout stays in the stylesheet.
          */}
        <div className="acct-links [&>a]:text-ink [&>a:hover]:text-ink [&>button]:text-ink [&>button:hover]:text-ink [&>button]:font-body [&>button]:text-[13px] [&>button]:tracking-normal">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Up to two letters of a name: "Gerardo Galan" is GG, "Ana" is A, nothing is
 * nothing — the caller falls back to the email's first letter, and past that
 * to a blank disc.
 */
export function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
