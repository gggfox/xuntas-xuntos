import { useThemeContext } from '../ThemeProvider'
import { displayedPreference, nextPreference, type ThemePreference } from '../../lib/theme'
import Icons from '../Icons'
import * as m from '../../paraglide/messages.js'

const ICON = {
  system: Icons.ThemeSystem,
  light: Icons.ThemeLight,
  dark: Icons.ThemeDark,
} as const

const NAME: Record<ThemePreference, () => string> = {
  system: m.theme_system,
  light: m.theme_light,
  dark: m.theme_dark,
}

/**
 * One button, three states.
 *
 * A cycling control is smaller than a segmented one and harder to read — the
 * state is only legible from the icon, and pressing it is the only way to
 * find out where it goes. That cost is paid down here and not elsewhere:
 * three distinct shapes, a label naming both the current state and the next
 * action, and a live region, because a button whose own label changes under
 * the cursor is not otherwise announced.
 */
export default function ThemeToggle() {
  const { preference, mounted, setPreference } = useThemeContext()
  const upcoming = nextPreference(preference)

  /*
   * The theme is not knowable on the server, and the server always renders
   * as if it were `system` even when the visitor has a stored choice — so
   * the icon AND the label both have to fall back to `system` until mount
   * confirms we are past hydration. The icon alone was guarded here before;
   * the label was not, and a restored `dark`/`light` preference left the
   * button's `aria-label`/`title` permanently wrong after a reload — React
   * does not patch up an attribute mismatch once it has hydrated. Rendering
   * nothing pre-mount would collapse the header's layout and shift the nav,
   * so `system` stands in for all of it, the same way the icon already did.
   *
   * `displayedPreference` lives in `src/lib/theme.ts`, not here, so this
   * rule is testable as arithmetic instead of only through a component that
   * cannot reproduce a real hydration boundary — see `tests/theme.test.ts`.
   */
  const displayPreference = displayedPreference(preference, mounted)
  const displayUpcoming = nextPreference(displayPreference)
  const Icon = ICON[displayPreference]
  const label = `${m.theme_label()}: ${NAME[displayPreference]()}. ${m.theme_switch_to({ theme: NAME[displayUpcoming]() })}`

  return (
    <>
      <button
        type="button"
        onClick={() => setPreference(upcoming)}
        aria-label={label}
        title={label}
        className="inline-flex size-[30px] flex-none items-center justify-center rounded-full text-white/72 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Icon className="size-[15px]" />
      </button>
      <span aria-live="polite" className="sr-only">
        {mounted ? `${m.theme_label()}: ${NAME[preference]()}` : ''}
      </span>
    </>
  )
}
