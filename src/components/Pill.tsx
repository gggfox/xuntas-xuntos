/**
 * A small capsule of metadata: a role, a state, a count.
 *
 * The five tones are the semantic palette from `docs/BRAND.md` and nothing
 * else — green, amber and red say something about the data and never
 * decorate, and `brand` is the one solid yellow a screen is allowed. The
 * word inside is what carries the meaning; the colour only repeats it,
 * because colour is never the only signal.
 *
 * It exists so the several places that draw one — the staff table's roles,
 * an invitation's state, the athlete's three status axes — cannot drift into
 * five spellings of the same `.chip` class list.
 */

export type PillTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'brand'

const TONE: Record<PillTone, string> = {
  neutral: 'chip',
  ok: 'chip chip-ok',
  warn: 'chip chip-warn',
  bad: 'chip chip-bad',
  brand: 'chip chip-y',
}

type Props = {
  tone?: PillTone
  children: React.ReactNode
}

export default function Pill({ tone = 'neutral', children }: Props) {
  return <span className={TONE[tone]}>{children}</span>
}

type ToggleProps = {
  pressed: boolean
  onToggle: (pressed: boolean) => void
  disabled?: boolean
  children: React.ReactNode
}

/**
 * The same pill, asking a question instead of reporting one.
 *
 * A real `<button aria-pressed>` rather than a checkbox with a label: the
 * roles on this screen are a short, closed set that reads as a row of
 * choices, and a switch is what a screen reader is told this is. The chosen
 * ones fill with ink; the styling lives in `styles.css` beside `.chip`.
 */
export function PillToggle({ pressed, onToggle, disabled, children }: ToggleProps) {
  return (
    <button
      type="button"
      className="chip chip-toggle"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onToggle(!pressed)}
    >
      {children}
    </button>
  )
}
