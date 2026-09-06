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
 * jsdom implements no pointer events at all, so `PointerEvent` is absent and
 * Testing Library quietly falls back to a plain `Event` — which drops
 * `pointerType`, the one field on it that carries any meaning here.
 *
 * `RolePills` reads that field to tell a mouse arriving from a finger
 * tapping, because a tap fires `pointerenter` before its click and acting on
 * both would open the panel and immediately shut it again. Without this shim
 * every pointer event under test claims to be from nothing at all, and the
 * hover path is untestable. A `MouseEvent` carrying the pointer fields is
 * what the real one is.
 */
window.PointerEvent ??= class PointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly pointerType: string
  readonly isPrimary: boolean
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
    this.pointerType = init.pointerType ?? ''
    this.isPrimary = init.isPrimary ?? false
  }
} as unknown as typeof window.PointerEvent

/**
 * jsdom knows the `<dialog>` element and its `open` attribute, but implements
 * neither `showModal` nor `close` — so a component that opens itself the way
 * the browser wants renders as a closed, `display: none` dialog under test.
 * These two stand in for exactly what the app relies on: the element becomes
 * open, and closing it fires `close` so React hears about it. The top layer,
 * the inert backdrop and the focus trap are the browser's and are not
 * simulated; nothing here asserts on them.
 */
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event('close'))
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
