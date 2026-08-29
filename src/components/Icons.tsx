/**
 * Every inline icon in the app, under one name: `Icons.Chevron`,
 * `Icons.Calendar`, `Icons.Check`, `Icons.Document`, `Icons.Award`,
 * `Icons.Shield`, `Icons.BrandMark`.
 *
 * One import instead of three, and one place to look when a new icon is
 * needed — which also makes the answer to "do we already draw this?"
 * cheap to check.
 *
 * The rules each icon here follows:
 *
 *  - Strokes and fills are `currentColor`, never a hex. An icon takes the
 *    color of whatever it sits in, so a palette move in `styles.css` moves
 *    the icons with it.
 *  - `aria-hidden` by default. These sit inside buttons that already carry
 *    an `aria-label`; a second name would only be read twice. `BrandMark`
 *    is the exception — it is the wordmark, so it is labelled.
 *  - Props land after the defaults, so any call site can override the size,
 *    the class, or the labelling without a new component.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

/** The one arrow in the app. Down is the drawn one; the rest are rotations. */
function Chevron({ dir, style, ...props }: IconProps & { dir: 'left' | 'right' | 'down' }) {
  const rotate = dir === 'left' ? 90 : dir === 'right' ? -90 : 0
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      {...props}
      /* Down carries no inline transform: the open/closed rotation of the
         calendar title's caret is a CSS transition, and a style attribute
         would outrank it. */
      style={rotate === 0 ? style : { transform: `rotate(${rotate}deg)`, ...style }}
    >
      <path
        d="M2.5 4.25 6 7.75l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Calendar(props: IconProps) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect
        x="1.75"
        y="3.25"
        width="12.5"
        height="11"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M1.75 6.5h12.5M5.25 1.75v2.5M10.75 1.75v2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A step that is done, a box that is ticked. Drawn once, used for both. */
function Check(props: IconProps) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2.25 6.4 4.8 9l5-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The three confirmations, one each: the terms, the scholarship, the notice. */
function Document(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M11.5 2.5H5.75A1.75 1.75 0 0 0 4 4.25v11.5a1.75 1.75 0 0 0 1.75 1.75h8.5A1.75 1.75 0 0 0 16 15.75V7z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M11.5 2.5V7H16M7 10.5h6M7 13.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Award(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <circle cx="10" cy="7.75" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6.75 11.75 5.5 17.5l4.5-2.25 4.5 2.25-1.25-5.75"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Shield(props: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10 2.5 4.25 4.75v4.5c0 3.4 2.35 6.55 5.75 7.75 3.4-1.2 5.75-4.35 5.75-7.75v-4.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M7.75 9.75 9.25 11.25l3-3.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The XUNTAS mark.
 *
 * Inline and not an `<img>` on purpose: the paths are `currentColor`, so the
 * mark takes the color of whatever it sits in. On the ink header that is
 * `text-yel`, and if the palette in `styles.css` ever moves, this moves with
 * it. An `<img>` would carry a hardcoded hex and quietly drift.
 *
 * The artwork is the one from xuntas.org (`favicon.svg` there). Only the
 * fill was changed — the site ships it in its own yellow, `#ebf437`, which is
 * a different yellow from this app's `--color-yel`.
 *
 * Sized by the caller: no intrinsic width/height, so a `className` decides.
 */
function BrandMark(props: IconProps) {
  return (
    <svg viewBox="0 0 270 143" fill="currentColor" role="img" aria-label="XUNTAS" {...props}>
      <path d="m269.3 32.6l-12.2-4.8-4.3-27.8h-4.8l-3.8 27.8-12.2 4.8v5.1l12.2 4.9 3.8 27.9h4.8l4.3-27.9 12.2-4.9z" />
      <path d="m125.2 98.8c35.7-1.4 70.7 13.2 104.3 43.4h24.8c-41.1-42.8-84.8-63.6-129.8-61.8-62.8 2.6-108.2 48.1-120.5 61.8h24.6c19.1-17.1 53.8-41.7 96.6-43.4z" />
      <path d="m181.3 40.5q0.6 0 1.3 0v-18.4c-0.8 0-1.6 0-2.4 0.1-45.1 3.5-90.6 26.2-131.5 65.6-23.6 22.9-39.3 44.9-45.6 54.4h20.7c22.5-30.3 79.7-95.7 157.5-101.7z" />
      <path d="m71.5 45.6c24.9-2 50.4 54.6 65.8 96.6h17.3c-28.1-79.7-55.6-117.3-84.3-114.9-20.3 1.6-38.6 23.5-54.3 64.8-7.6 19.9-12.7 39.4-15.3 50.1h16.6c8.6-33.7 29-94.5 54.2-96.6z" />
    </svg>
  )
}

export const Icons = { Chevron, Calendar, Check, Document, Award, Shield, BrandMark }

export default Icons
