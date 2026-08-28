/**
 * The XUNTAS mark, inline.
 *
 * Inline and not an `<img>` on purpose: the paths are `currentColor`, so the
 * mark takes the color of whatever it sits in. On the ink header that is
 * `text-yel`, and if the palette in `styles.css` ever moves, this moves with
 * it. An `<img>` would carry a hardcoded hex and quietly drift.
 *
 * The artwork is the one from xuntas.org (`favicon.svg` there). Only the
 * fill was changed — the site ships it in its own yellow, `#ebf437`, which is
 * a different yellow from this app's `--color-yel`.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 270 143"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="XUNTAS"
    >
      <path d="m269.3 32.6l-12.2-4.8-4.3-27.8h-4.8l-3.8 27.8-12.2 4.8v5.1l12.2 4.9 3.8 27.9h4.8l4.3-27.9 12.2-4.9z" />
      <path d="m125.2 98.8c35.7-1.4 70.7 13.2 104.3 43.4h24.8c-41.1-42.8-84.8-63.6-129.8-61.8-62.8 2.6-108.2 48.1-120.5 61.8h24.6c19.1-17.1 53.8-41.7 96.6-43.4z" />
      <path d="m181.3 40.5q0.6 0 1.3 0v-18.4c-0.8 0-1.6 0-2.4 0.1-45.1 3.5-90.6 26.2-131.5 65.6-23.6 22.9-39.3 44.9-45.6 54.4h20.7c22.5-30.3 79.7-95.7 157.5-101.7z" />
      <path d="m71.5 45.6c24.9-2 50.4 54.6 65.8 96.6h17.3c-28.1-79.7-55.6-117.3-84.3-114.9-20.3 1.6-38.6 23.5-54.3 64.8-7.6 19.9-12.7 39.4-15.3 50.1h16.6c8.6-33.7 29-94.5 54.2-96.6z" />
    </svg>
  )
}
