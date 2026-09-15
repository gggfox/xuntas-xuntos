import { useLayoutEffect, useRef } from 'react'

/** Below this the table is a slit; the page scrolls instead. */
const MIN = 240

/**
 * Sizes a card to the window: from where the card starts to where the page's
 * chrome under it — the frame's bottom padding, the footer — begins. The
 * value goes out as `--tall-h`, which `.tall-card` reads from `lg` up (see
 * styles.css); below that width the variable is set and ignored.
 *
 * Measured rather than computed because nothing above the card has a fixed
 * height: the header is a line box plus padding, the admin strip wraps at
 * some widths, and a flex chain from `<body>` cannot do it either — the body
 * has a *minimum* height, not a height, so a tall table grows the page
 * instead of scrolling inside it. The card is briefly stretched past the
 * window before measuring so the footer's `mt-auto` slack cannot be mistaken
 * for chrome; that happens inside a layout effect, before paint.
 */
export function useFillHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      el.style.setProperty('--tall-h', '200vh')
      const rect = el.getBoundingClientRect()
      const top = rect.top + window.scrollY
      const below = document.documentElement.scrollHeight - (rect.bottom + window.scrollY)
      el.style.setProperty('--tall-h', `${Math.max(MIN, window.innerHeight - top - below)}px`)
    }

    measure()
    window.addEventListener('resize', measure)
    // The fonts arriving, the strip wrapping, a note appearing above the
    // table: anything that moves the card's top edge is a body resize.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(document.body)
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [])

  return ref
}
