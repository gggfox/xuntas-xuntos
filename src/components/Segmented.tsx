import { useRef } from 'react'

type Item<T extends string> = { id: T; label: string }

type Props<T extends string> = {
  /**
   * Prefix for the segment ids, so the page can point the panel's
   * `aria-labelledby` at whichever segment is currently chosen.
   */
  name: string
  /** Names the group for a screen reader. */
  label: string
  value: T
  items: readonly Item<T>[]
  onChange: (id: T) => void
  /** The region this control swaps, when the page renders one. */
  panelId?: string
}

/** The id `Segmented` gives a segment, for a panel's `aria-labelledby`. */
export function segmentId(name: string, id: string): string {
  return `${name}-seg-${id}`
}

/**
 * Two or three views of one region, as one joined control.
 *
 * The staff screen used to stack its two tables down the page under their
 * own headings, which meant scrolling past every member of the team to
 * reach the invitations — and invitations are the half that needs chasing.
 * One region and a switch is the shape that fits: the tables answer the
 * same question about the same people, so only one of them is ever the
 * answer.
 *
 * `role="tablist"`, not a radio group: these select which view is shown,
 * which is what a tab is, and it is the role the registrations screen's
 * views already announce. That role comes with a contract — one stop in the
 * tab order, arrows to move between the segments — so the roving
 * `tabIndex` and the key handler below are not polish, they are the rest of
 * the role.
 */
export default function Segmented<T extends string>({
  name,
  label,
  value,
  items,
  onChange,
  panelId,
}: Props<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement | null>())

  /* Arrows wrap around; Home and End jump to the ends. Moving selects, which
     is the behaviour for a tablist whose panels are already in the page —
     nothing is fetched by arrowing across. */
  function onKeyDown(ev: React.KeyboardEvent) {
    const at = items.findIndex((it) => it.id === value)
    const to =
      ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
        ? (at + 1) % items.length
        : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'
          ? (at - 1 + items.length) % items.length
          : ev.key === 'Home'
            ? 0
            : ev.key === 'End'
              ? items.length - 1
              : -1
    if (to === -1) return
    ev.preventDefault()
    const next = items[to]
    onChange(next.id)
    refs.current.get(next.id)?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="seg" onKeyDown={onKeyDown}>
      {items.map((it) => (
        <button
          key={it.id}
          ref={(el) => {
            refs.current.set(it.id, el)
          }}
          id={segmentId(name, it.id)}
          type="button"
          role="tab"
          aria-selected={it.id === value}
          aria-controls={panelId}
          tabIndex={it.id === value ? 0 : -1}
          className="seg-btn"
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
