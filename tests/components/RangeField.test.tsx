import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RangeField from '../../src/components/DateField/RangeField'

function renderField(start = '', end = '') {
  const onChange = vi.fn<(v: { start: string; end: string }) => void>()
  render(
    <RangeField id="win" label="Ventana" start={start} end={end} onChange={onChange} min="2026-09-01" max="2026-09-30" />,
  )
  return { onChange }
}

describe('RangeField', () => {
  it('takes the first click as the start and the second as the end', () => {
    const { onChange } = renderField()
    fireEvent.click(screen.getByRole('button', { name: /4 de septiembre|September 4/ }))
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-04', end: '' })
  })

  it('completes the range on the second click and starts over on the third', () => {
    const { onChange } = renderField('2026-09-04', '')
    fireEvent.click(screen.getByRole('button', { name: /18 de septiembre|September 18/ }))
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-04', end: '2026-09-18' })
  })

  it('swaps a second click that lands before the first', () => {
    const { onChange } = renderField('2026-09-18', '')
    fireEvent.click(screen.getByRole('button', { name: /4 de septiembre|September 4/ }))
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-04', end: '2026-09-18' })
  })

  it('tints the days between start and end', () => {
    renderField('2026-09-04', '2026-09-06')
    expect(screen.getByRole('button', { name: /5 de septiembre|September 5/ })).toHaveAttribute('data-range', 'mid')
    expect(screen.getByRole('button', { name: /4 de septiembre|September 4/ })).toHaveAttribute('data-range', 'start')
  })
})
