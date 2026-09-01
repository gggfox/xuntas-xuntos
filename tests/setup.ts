import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * jsdom implements no scrolling at all, so `scrollIntoView` is simply absent.
 * The form calls it when a failed submit moves focus to the first bad field —
 * real behaviour worth keeping, so the gap is filled here rather than guarded
 * around in the component.
 */
Element.prototype.scrollIntoView ??= () => {}

/**
 * Node ships its own experimental global `localStorage` (gated behind a
 * `--localstorage-file` flag), and it shadows jsdom's real one: vitest
 * copies jsdom's globals onto `globalThis`, but that assignment silently
 * hits Node's own setter instead of replacing the accessor, so
 * `window.localStorage` resolves to Node's version — which returns
 * `undefined` without the flag. `ThemeProvider` persists the preference
 * there, so the harness needs a working store; a plain in-memory one is
 * enough for a test run.
 */
if (typeof window.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  })
}

/**
 * jsdom implements no media queries either, so `matchMedia` is absent
 * entirely. `ThemeProvider` asks it whether the OS wants dark the moment it
 * mounts. Reporting "light" keeps the default deterministic; a test that
 * cares about the OS preference overrides this itself.
 */
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia

// Vitest does not unmount between tests on its own, and a left-over tree keeps
// its timers running — which the autosave test would then see.
afterEach(() => {
  cleanup()
})
