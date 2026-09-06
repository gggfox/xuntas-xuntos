import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RangeField from '../../src/components/DateField/RangeField'

function renderField(start = '', end = '') {
  const onChange = vi.fn<(v: { start: string; end: string }) => void>()
  render(
    <RangeField id="win" label="Ventana" start={start} end={end} onChange={onChange} min="2026-09-01" max="2026-09-30" />,
  )
  return { onChange }
}

/** This jsdom harness renders English, so the boxes take mm/dd/yyyy. */
const startBox = () => screen.getByRole('textbox', { name: m.range_start() })
const endBox = () => screen.getByRole('textbox', { name: m.range_end() })

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

/**
 * The boxes used to take a raw `yyyy-mm-dd` and pass it straight through, so
 * `2026-09-33` in CLOSES did nothing at all — no complaint, no rejection.
 * They now take the same masked, locale-ordered format as `DateField`, and
 * validate the same way: quiet while a day is half typed, out loud once it
 * is complete.
 */
describe('typing into the boxes', () => {
  it('says nothing while a day is still half typed', () => {
    const { onChange } = renderField()
    fireEvent.change(startBox(), { target: { value: '0904' } })

    expect(startBox()).toHaveAttribute('aria-invalid', 'false')
    expect(onChange).toHaveBeenLastCalledWith({ start: '', end: '' })
  })

  it('reports a day that does not exist once it is complete', () => {
    renderField()
    fireEvent.change(startBox(), { target: { value: '02302026' } })

    expect(screen.getByText(m.date_invalid())).toBeInTheDocument()
    expect(startBox()).toHaveAttribute('aria-invalid', 'true')
  })

  it('updates the value for a well-formed day in the locale order', () => {
    const { onChange } = renderField()
    fireEvent.change(startBox(), { target: { value: '09042026' } })

    expect(startBox()).toHaveValue('09/04/2026')
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-04', end: '' })
  })

  it('reports a closing day that falls before the opening day', () => {
    const { onChange } = renderField('2026-09-18', '')
    fireEvent.change(endBox(), { target: { value: '09042026' } })

    // Both days are real and in range on their own — only the pair is wrong.
    expect(screen.queryByText(m.date_invalid())).not.toBeInTheDocument()
    expect(screen.getByText(m.range_reversed())).toBeInTheDocument()
    expect(endBox()).toHaveAttribute('aria-invalid', 'true')
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-09-18', end: '2026-09-04' })
  })
})
