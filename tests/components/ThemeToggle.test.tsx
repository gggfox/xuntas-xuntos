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
     * already was. Without that gate, a restored `dark`/`light` preference
     * left the aria-label and title permanently stuck on the pre-mount
     * `system` fallback, because a real SSR pass always renders as if the
     * preference were `system`, and React does not patch up an attribute
     * mismatch once it has hydrated. This can't reproduce the SSR mismatch
     * itself (this harness renders client-only), but it pins the half that
     * matters here: once mounted with a stored preference, both the button
     * and the live region must lead with the real state, not `system`.
     */
    const currentState = `${m.theme_label()}: ${m.theme_dark()}`
    const label = button().getAttribute('aria-label') ?? ''
    expect(label.startsWith(currentState)).toBe(true)

    const live = container.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe(currentState)
  })

  /**
   * The one thing a cycling button owes a screen-reader user: the label has
   * to say where you are AND where the next press goes. Without the second
   * half the control is a coin flip.
   *
   * Labels are matched through the message functions rather than as
   * literals — see the header comment in RegistrationForm.test.tsx for why.
   * `theme_system`/`theme_light`/`theme_dark` are also asserted distinct
   * from one another so "contains both names" can't degenerate into
   * comparing a value to itself.
   */
  it('names the current state and the next action at every stop', () => {
    renderToggle()
    const label = () => button().getAttribute('aria-label') ?? ''
    const system = m.theme_system()
    const light = m.theme_light()
    const dark = m.theme_dark()
    expect(system).not.toBe(light)
    expect(light).not.toBe(dark)
    expect(dark).not.toBe(system)

    // system, about to switch to light
    expect(label()).toContain(system)
    expect(label()).toContain(light)

    fireEvent.click(button())
    // light, about to switch to dark
    expect(label()).toContain(light)
    expect(label()).toContain(dark)

    fireEvent.click(button())
    // dark, about to switch to system
    expect(label()).toContain(dark)
    expect(label()).toContain(system)
  })

  it('announces the change in a live region', () => {
    const { container } = renderToggle()
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    fireEvent.click(button())
    expect(live?.textContent ?? '').toContain(m.theme_light())
  })
})
