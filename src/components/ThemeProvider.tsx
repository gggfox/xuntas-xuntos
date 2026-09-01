import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  THEME_STORAGE_KEY,
  readStoredPreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme'

type ThemeContextValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  /**
   * False during SSR and on the very first client render. The theme is not
   * knowable on the server, so anything that would render differently per
   * theme waits for this rather than causing a hydration mismatch.
   */
  mounted: boolean
  setPreference: (next: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeContext must be used inside <ThemeProvider>')
  return ctx
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Owns the theme preference.
 *
 * It sits ABOVE ClerkProvider, because Clerk has to be handed the resolved
 * theme for its own components. That is also why it knows nothing about
 * Convex: there is no session this high up. `ThemeSync`, further down the
 * tree, is the half that talks to the account.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  /*
   * Lazily initialised from what the pre-paint script already decided, so the
   * first client render agrees with the DOM instead of rendering `system` and
   * correcting in an effect.
   */
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system'
    try {
      return readStoredPreference(window.localStorage.getItem(THEME_STORAGE_KEY))
    } catch {
      return 'system'
    }
  })

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(DARK_QUERY).matches
  })

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  /*
   * Subscribed only while the preference actually depends on the OS. Someone
   * who has pinned light does not need their machine's night schedule
   * re-rendering this tree at sunset.
   */
  useEffect(() => {
    if (preference !== 'system') return
    // jsdom has no `matchMedia` at all; `tests/setup.ts` stubs it, and this
    // guard means a harness that forgets to is a no-op rather than a crash.
    if (!window.matchMedia) return
    const mq = window.matchMedia(DARK_QUERY)
    setSystemPrefersDark(mq.matches)
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const resolved = resolveTheme(preference, systemPrefersDark)

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* Private mode. The choice still applies for this page's lifetime. */
    }
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, mounted, setPreference }),
    [preference, resolved, mounted, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
