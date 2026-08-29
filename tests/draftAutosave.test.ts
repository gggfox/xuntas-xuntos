import { describe, expect, it } from 'vitest'
import { fingerprint, shouldSaveDraft } from '../src/lib/draftAutosave'

describe('fingerprint', () => {
  it('is stable for equal values', () => {
    expect(fingerprint({ a: 1, b: [2] })).toBe(fingerprint({ a: 1, b: [2] }))
  })

  it('differs when a value changes', () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }))
  })
})

describe('shouldSaveDraft', () => {
  it('saves when the values changed', () => {
    expect(shouldSaveDraft(fingerprint({ a: 2 }), fingerprint({ a: 1 }))).toBe(true)
  })

  /**
   * The loop cut. A save bumps `updatedAt`, the reactive query refires, the
   * parent re-renders and hands the same values back. If that re-render saved
   * again, every open tab would write to Convex forever with nobody typing.
   */
  it('does not save when the values are unchanged', () => {
    const f = fingerprint({ a: 1 })
    expect(shouldSaveDraft(f, f)).toBe(false)
  })
})
