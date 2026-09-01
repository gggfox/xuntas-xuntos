/**
 * Meteors: nine hairline streaks falling across the whole window.
 *
 * This is the only decoration on the site, and BRAND.md is explicit that
 * things here "never decorate" — so what is left holding it back is that
 * there are only nine of them, that the tails are drawn at the same 22 % ink
 * the rest of the site rules its lines at, and that the layer disappears
 * entirely for anyone who asks for less motion.
 *
 * The layer is fixed to the viewport rather than parked at the top of the
 * page, so it keeps going while the reader scrolls the eight steps. That is
 * a deliberate choice and the loud one: ambient motion sits in the corner of
 * the eye of somebody typing their school and their GHIN number.
 *
 * The positions are written out rather than generated. The version this was
 * ported from picks them with `Math.random()` at render, which under TanStack
 * Start is a hydration mismatch; it also clumps, and three overlapping
 * streaks is the one frame a reader notices. Nine starts placed by hand —
 * five along the top edge, four down the left — do not.
 *
 * It renders once and is never keyed to the step: replaying the animation on
 * every "next" would turn ambient motion into an event, eight times, exactly
 * as someone is trying to move on.
 *
 * The layer is `aria-hidden` and takes no pointer events, and it is removed
 * outright under `prefers-reduced-motion` — see the note in `styles.css` for
 * why hiding it is not the same as letting the global rule stop it.
 *
 * Requires `relative isolate` on the containing element. The `isolate` is not
 * optional: see `.meteors` in `styles.css`.
 */

/**
 * Where each streak enters, when it starts, and how long one crossing takes.
 *
 * They travel down and to the right, so a start is only useful on the top
 * edge or the left one — anything entering at the bottom right leaves before
 * it is seen. The delays are picked so no two neighbours ever fire together.
 */
const METEORS: ReadonlyArray<[left: string, top: string, delay: string, duration: string]> = [
  ['-12%', '-80px', '0s', '6.0s'],
  ['4%', '-80px', '2.9s', '7.4s'],
  ['22%', '-80px', '1.1s', '5.2s'],
  ['45%', '-80px', '4.6s', '6.8s'],
  ['68%', '-80px', '0.6s', '8.0s'],
  ['-12%', '16%', '3.4s', '5.6s'],
  ['-12%', '38%', '1.9s', '7.0s'],
  ['-12%', '60%', '5.5s', '6.2s'],
  ['10%', '76%', '2.3s', '5.0s'],
]

export default function Meteors() {
  return (
    <div className="meteors" aria-hidden="true">
      {METEORS.map(([left, top, animationDelay, animationDuration]) => (
        <i
          key={`${left} ${top}`}
          className="meteor"
          style={{ left, top, animationDelay, animationDuration }}
        />
      ))}
    </div>
  )
}
