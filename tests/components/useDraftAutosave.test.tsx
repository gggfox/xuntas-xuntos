import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraftAutosave } from '../../src/hooks/useDraftAutosave'

function Harness({
  values,
  onSave,
  initial,
  flushRef,
}: {
  values: { a: number }
  initial: { a: number }
  onSave: (v: { a: number }) => void
  /** How a test reaches the flush without a button to press. */
  flushRef?: { current: (() => void) | null }
}) {
  const flush = useDraftAutosave({ values, initial, enabled: true, delayMs: 1200, onSave })
  if (flushRef) flushRef.current = flush
  return null
}

describe('useDraftAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves once after the debounce when values change', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const { rerender } = render(<Harness values={initial} initial={initial} onSave={onSave} />)
    rerender(<Harness values={{ a: 1 }} initial={initial} onSave={onSave} />)
    act(() => void vi.advanceTimersByTime(1300))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not save when nothing was touched', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    render(<Harness values={{ a: 0 }} initial={initial} onSave={onSave} />)
    act(() => void vi.advanceTimersByTime(5000))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('waits for the typing to stop rather than saving every keystroke', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const { rerender } = render(<Harness values={initial} initial={initial} onSave={onSave} />)

    for (const a of [1, 2, 3]) {
      rerender(<Harness values={{ a }} initial={initial} onSave={onSave} />)
      act(() => void vi.advanceTimersByTime(400))
    }
    expect(onSave).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(1300))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ a: 3 })
  })

  /**
   * THE regression. After a save, the reactive query refires and the parent
   * re-renders with the same values. That must not trigger another save, or
   * every open tab writes to Convex forever.
   */
  it('does not save again when re-rendered with the values it just saved', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const { rerender } = render(<Harness values={initial} initial={initial} onSave={onSave} />)

    rerender(<Harness values={{ a: 1 }} initial={initial} onSave={onSave} />)
    act(() => void vi.advanceTimersByTime(1300))
    expect(onSave).toHaveBeenCalledTimes(1)

    // The re-render caused by the save landing.
    rerender(<Harness values={{ a: 1 }} initial={initial} onSave={onSave} />)
    act(() => void vi.advanceTimersByTime(5000))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not save while the form is not editable', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    function Locked({ values }: { values: { a: number } }) {
      useDraftAutosave({ values, initial, enabled: false, delayMs: 1200, onSave })
      return null
    }
    const { rerender } = render(<Locked values={initial} />)
    rerender(<Locked values={{ a: 1 }} />)
    act(() => void vi.advanceTimersByTime(5000))
    expect(onSave).not.toHaveBeenCalled()
  })
})

/**
 * Leaving a step is a moment where the work is done but the silence has not
 * arrived. Filling a step in and pressing "next" inside the debounce window
 * used to lose it if the tab closed on the way.
 */
describe('useDraftAutosave flush', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves immediately instead of waiting out the debounce', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const flushRef: { current: (() => void) | null } = { current: null }
    const { rerender } = render(
      <Harness values={initial} initial={initial} onSave={onSave} flushRef={flushRef} />,
    )

    rerender(<Harness values={{ a: 1 }} initial={initial} onSave={onSave} flushRef={flushRef} />)
    expect(onSave).not.toHaveBeenCalled()

    act(() => flushRef.current?.())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ a: 1 })
  })

  /** The flush cancels the pending timer rather than racing it. */
  it('does not save a second time when the debounce would have fired', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const flushRef: { current: (() => void) | null } = { current: null }
    const { rerender } = render(
      <Harness values={initial} initial={initial} onSave={onSave} flushRef={flushRef} />,
    )

    rerender(<Harness values={{ a: 1 }} initial={initial} onSave={onSave} flushRef={flushRef} />)
    act(() => flushRef.current?.())
    act(() => void vi.advanceTimersByTime(5000))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  /** Which is what makes flushing on every step change cost nothing. */
  it('writes nothing when the step changed but no value did', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const flushRef: { current: (() => void) | null } = { current: null }
    render(<Harness values={initial} initial={initial} onSave={onSave} flushRef={flushRef} />)

    act(() => flushRef.current?.())
    act(() => flushRef.current?.())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not write once the window has closed', () => {
    const onSave = vi.fn()
    const initial = { a: 0 }
    const flushRef: { current: (() => void) | null } = { current: null }
    function Locked({ values }: { values: { a: number } }) {
      flushRef.current = useDraftAutosave({
        values,
        initial,
        enabled: false,
        delayMs: 1200,
        onSave,
      })
      return null
    }
    const { rerender } = render(<Locked values={initial} />)
    rerender(<Locked values={{ a: 1 }} />)
    act(() => flushRef.current?.())
    expect(onSave).not.toHaveBeenCalled()
  })
})
