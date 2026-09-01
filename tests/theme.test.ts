import { describe, expect, it } from 'vitest'
import {
  THEME_STORAGE_KEY,
  nextPreference,
  readStoredPreference,
  resolveTheme,
  type ThemePreference,
} from '../src/lib/theme'

describe('resolveTheme', () => {
  it('passes an explicit preference straight through, whatever the OS says', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the OS only when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('nextPreference', () => {
  it('cycles system to light to dark and back', () => {
    expect(nextPreference('system')).toBe('light')
    expect(nextPreference('light')).toBe('dark')
    expect(nextPreference('dark')).toBe('system')
  })

  it('is total: three presses from any start return to that start', () => {
    for (const start of ['system', 'light', 'dark'] as const) {
      expect(nextPreference(nextPreference(nextPreference(start)))).toBe(start)
    }
  })

  it('recovers to system from a value that is not a preference at all', () => {
    expect(nextPreference('nonsense' as ThemePreference)).toBe('system')
  })
})

/**
 * The storage key is writable by anyone with a browser console, so every one
 * of these must degrade to `system` rather than reach the DOM or throw. This
 * is the test that matters: a bad value here would otherwise be stamped
 * straight onto `data-theme`.
 */
describe('readStoredPreference', () => {
  it('accepts exactly the three valid values', () => {
    expect(readStoredPreference('system')).toBe('system')
    expect(readStoredPreference('light')).toBe('light')
    expect(readStoredPreference('dark')).toBe('dark')
  })

  it('falls back to system for absent, empty, miscased and junk values', () => {
    expect(readStoredPreference(null)).toBe('system')
    expect(readStoredPreference('')).toBe('system')
    expect(readStoredPreference('DARK')).toBe('system')
    expect(readStoredPreference('Light')).toBe('system')
    expect(readStoredPreference('nonsense')).toBe('system')
    expect(readStoredPreference('{"preference":"dark"}')).toBe('system')
    expect(readStoredPreference('__proto__')).toBe('system')
  })
})

describe('THEME_STORAGE_KEY', () => {
  it('is namespaced so it cannot collide with another app on localhost', () => {
    expect(THEME_STORAGE_KEY).toBe('xx-theme')
  })
})
