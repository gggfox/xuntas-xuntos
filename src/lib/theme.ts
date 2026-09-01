/**
 * Theme resolution, with no DOM and no React.
 *
 * The rules are here on their own so they can be tested as arithmetic — the
 * same reason `registrationRules.ts` and `cycle.ts` exist. Everything that
 * touches `localStorage`, `matchMedia` or the document lives in
 * `src/components/ThemeProvider.tsx` and imports from here.
 */

/** What the person chose. `system` means "follow the OS", and is the default. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** What actually gets painted. `system` has already been resolved away. */
export type ResolvedTheme = 'light' | 'dark'

/**
 * Namespaced: on localhost this origin is shared with whatever else the
 * developer is running, and a bare `theme` key collides.
 */
export const THEME_STORAGE_KEY = 'xx-theme'

const PREFERENCES: ReadonlyArray<ThemePreference> = ['system', 'light', 'dark']

function isPreference(value: unknown): value is ThemePreference {
  return PREFERENCES.includes(value as ThemePreference)
}

/**
 * Parses whatever `localStorage` handed back.
 *
 * Anything unrecognised becomes `system` rather than throwing. The key is
 * writable from any browser console, and this value is stamped onto
 * `data-theme`; the only safe posture is to distrust it.
 */
export function readStoredPreference(raw: string | null): ThemePreference {
  return isPreference(raw) ? raw : 'system'
}

/** Collapses the three-state preference down to the two states CSS knows. */
export function resolveTheme(
  pref: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}

/**
 * The cycle the one button walks: system, then light, then dark, then back.
 *
 * Total by construction — an unrecognised input has an index of -1 and lands
 * on `system`, which is the right place for a value we do not understand.
 */
export function nextPreference(pref: ThemePreference): ThemePreference {
  return PREFERENCES[(PREFERENCES.indexOf(pref) + 1) % PREFERENCES.length]
}
