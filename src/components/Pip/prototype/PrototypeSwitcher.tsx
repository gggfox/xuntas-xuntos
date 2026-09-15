import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { PROTOTYPE_ON, VARIANTS, VARIANT_NAME, usePrototype, type Variant } from './usePrototype'

/*
 * PROTOTYPE — throwaway. The floating bar that flips `?variant=`. Painted
 * deliberately off-brand (purple, dashed) so nobody mistakes it for part of
 * the design being judged. Rendered only outside a production build.
 */
export default function PrototypeSwitcher() {
  const variant = usePrototype()
  const navigate = useNavigate({ from: '/prototype/pip' })

  const go = (v: Variant) => void navigate({ search: { variant: v }, replace: true })
  const at = VARIANTS.indexOf(variant)
  const step = (d: number) => go(VARIANTS[(at + d + VARIANTS.length) % VARIANTS.length])

  useEffect(() => {
    if (!PROTOTYPE_ON) return
    function onKey(ev: KeyboardEvent) {
      const t = ev.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable], [role="tablist"], dialog')) return
      // A lightbox owns the arrows while it is open.
      if (document.querySelector('dialog[open]')) return
      if (ev.key === 'ArrowLeft') step(-1)
      else if (ev.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!PROTOTYPE_ON) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-dashed border-[#f0abfc] bg-[#4c1d95] px-3 py-1.5 font-mono text-[11.5px] text-white shadow-[0_8px_24px_rgba(0,0,0,.35)]"
      role="group"
      aria-label="Prototipo: variante del feed"
    >
      <button type="button" className="px-2 py-1 hover:text-[#f0abfc]" onClick={() => step(-1)} aria-label="Variante anterior">
        ←
      </button>
      <span className="min-w-[260px] text-center tracking-[.04em]">
        {variant.toUpperCase()} · {VARIANT_NAME[variant]}
      </span>
      <button type="button" className="px-2 py-1 hover:text-[#f0abfc]" onClick={() => step(1)} aria-label="Variante siguiente">
        →
      </button>
    </div>
  )
}
