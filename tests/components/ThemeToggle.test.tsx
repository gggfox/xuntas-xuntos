import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
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
    renderToggle()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  /**
   * The one thing a cycling button owes a screen-reader user: the label has
   * to say where you are AND where the next press goes. Without the second
   * half the control is a coin flip.
   */
  it('names the current state and the next action at every stop', () => {
    renderToggle()
    const label = () => button().getAttribute('aria-label') ?? ''

    expect(label()).toMatch(/system/i)
    expect(label()).toMatch(/switch to light/i)

    fireEvent.click(button())
    expect(label()).toMatch(/light/i)
    expect(label()).toMatch(/switch to dark/i)

    fireEvent.click(button())
    expect(label()).toMatch(/dark/i)
    expect(label()).toMatch(/switch to system/i)
  })

  it('announces the change in a live region', () => {
    const { container } = renderToggle()
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    fireEvent.click(button())
    expect(live?.textContent ?? '').toMatch(/light/i)
  })
})
