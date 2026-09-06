import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Segmented, { segmentId } from '../../src/components/Segmented'

type View = 'a' | 'b' | 'c'

const items = [
  { id: 'a' as const, label: 'Alpha' },
  { id: 'b' as const, label: 'Beta' },
  { id: 'c' as const, label: 'Gamma' },
]

function setup(value: View = 'a') {
  const onChange = vi.fn()
  render(<Segmented name="t" label="Views" value={value} items={items} onChange={onChange} panelId="p" />)
  return { onChange }
}

describe('Segmented', () => {
  it('reports the chosen segment and points at the region it swaps', () => {
    setup('b')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-controls', 'p')
  })

  it('gives the page an id to label the panel with', () => {
    setup('b')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('id', segmentId('t', 'b'))
  })

  /**
   * A tablist is one stop in the tab order, not three: the reader tabs onto
   * the chosen segment and arrows between them. Without the roving
   * `tabIndex` this is three stops, which is exactly the thing the role
   * promises it is not.
   */
  it('keeps one stop in the tab order', () => {
    setup('b')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves with the arrows and wraps around', () => {
    const { onChange } = setup('c')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('jumps to the ends with Home and End', () => {
    const { onChange } = setup('b')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith('a')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' })
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('leaves other keys to the page', () => {
    const { onChange } = setup('a')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('switches on a press', () => {
    const { onChange } = setup('a')
    fireEvent.click(screen.getByRole('tab', { name: 'Gamma' }))
    expect(onChange).toHaveBeenCalledWith('c')
  })
})
