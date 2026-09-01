import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import ThemeProvider from '../../src/components/ThemeProvider'
import ThemeToggle from '../../src/components/AppBar/ThemeToggle'
import { THEME_STORAGE_KEY } from '../../src/lib/theme'

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

const button = () => screen.getByRole('button')

/**
 * Rebuilds the exact string the component builds, from the same message
 * functions it uses — never an English literal. This is deliberately
 * order-sensitive: `.toContain()` on the two names alone proves both appear
 * without proving which one is the current state and which is the next
 * action, and a transposition of the two in the component would still pass
 * such a check. `.toBe()` against this template does not.
 */
function stopLabel(current: string, next: string) {
  return `${m.theme_label()}: ${current}. ${m.theme_switch_to({ theme: next })}`
}

function liveText(current: string) {
  return `${m.theme_label()}: ${current}`
}

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('ThemeToggle', () => {
  it('starts on system and cycles to light, dark, then back', () => {
    renderToggle()
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()

    fireEvent.click(button())
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    fireEvent.click(button())
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    fireEvent.click(button())
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
  })

  it('applies the resolved theme to the document', () => {
    renderToggle()
    fireEvent.click(button()) // light
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(button()) // dark
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('restores the stored preference on mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { container } = renderToggle()
    expect(document.documentElement.dataset.theme).toBe('dark')

    /*
     * Regression guard for a hydration bug: the label and live region are
     * built from `preference`, gated on `mounted` the same way the icon
     * already was (via `displayedPreference` in `src/lib/theme.ts`).
     * Without that gate, a restored `dark`/`light` preference left the
     * aria-label and title permanently stuck on the pre-mount `system`
     * fallback, because a real SSR pass always renders as if the
     * preference were `system`, and React does not patch up an attribute
     * mismatch once it has hydrated. This can't reproduce the SSR mismatch
     * itself (this harness renders client-only), but it pins the half that
     * matters here: once mounted with a stored preference, both the button
     * and the live region must lead with the real state, not `system`.
     */
    expect(button().getAttribute('aria-label')).toBe(
      stopLabel(m.theme_dark(), m.theme_system()),
    )
    const live = container.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe(liveText(m.theme_dark()))
  })

  /**
   * The one thing a cycling button owes a screen-reader user: the label has
   * to say where you are AND where the next press goes, in that order.
   * `.toBe()` against the string rebuilt from the message functions is
   * order-sensitive on purpose — see `stopLabel`'s comment.
   */
  it('names the current state and the next action at every stop', () => {
    renderToggle()
    const label = () => button().getAttribute('aria-label')

    expect(label()).toBe(stopLabel(m.theme_system(), m.theme_light()))

    fireEvent.click(button())
    expect(label()).toBe(stopLabel(m.theme_light(), m.theme_dark()))

    fireEvent.click(button())
    expect(label()).toBe(stopLabel(m.theme_dark(), m.theme_system()))
  })

  it('announces the change in a live region', () => {
    const { container } = renderToggle()
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    fireEvent.click(button())
    expect(live?.textContent).toBe(liveText(m.theme_light()))
  })
})
