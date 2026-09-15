import * as m from '../paraglide/messages.js'

/**
 * What a screen shows while Convex answers: the shape of what is coming,
 * not a sentence about it.
 *
 * The sentence is still here. Every skeleton is one `role="status"` region
 * carrying the same "Cargando…" the text-only loaders used to print, only
 * visually hidden — a screen reader hears exactly what it heard before, and
 * the bars underneath are `aria-hidden` decoration. The bars pulse; the
 * global reduced-motion rule in styles.css stops them, as it stops
 * everything else.
 *
 * `Bone` is the one primitive; the shapes — a table, a card list, a page —
 * are built from it beside the component they stand in for, so that when a
 * column is added to a table its skeleton is a line away.
 */

/** One bar. Sized by the caller; a block unless told otherwise. */
export function Bone({ className = '', inline = false }: { className?: string; inline?: boolean }) {
  return <span aria-hidden="true" className={`bone ${inline ? 'inline-block align-middle' : ''} ${className}`} />
}

/** The region: announces the wait, marks itself busy, wraps the shape. */
export function Loading({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{m.common_loading()}</span>
      {children}
    </div>
  )
}

/** A paragraph's worth of lines; the last one shorter, as a paragraph ends. */
export function Lines({ n = 3, className = '' }: { n?: number; className?: string }) {
  return (
    <Loading className={`grid gap-2.5 ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <Bone key={i} className={i === n - 1 ? 'w-[62%]' : 'w-full'} />
      ))}
    </Loading>
  )
}

/**
 * A line inside a sentence that is otherwise real — the closing date in a
 * lede, the dates on the rules page — so the paragraph keeps its place
 * while the one fact it is waiting for arrives.
 */
export function TextLine({ className = 'w-[14ch]' }: { className?: string }) {
  return (
    <span role="status" aria-busy="true">
      <span className="sr-only">{m.common_loading()}</span>
      <Bone inline className={`h-[0.9em] ${className}`} />
    </span>
  )
}
