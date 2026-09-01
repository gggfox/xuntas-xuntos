import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import MonthField from '../../src/components/DateField/MonthField'

/**
 * The month box of the competitive calendar.
 *
 * It is `DateField`'s sibling and not a mode of it, because the two disagree
 * on every question the widget answers. `DateField` asks for a day decades
 * back and keeps its grid open beside the field; this one asks for a month
 * some way ahead, and lives in a 150px column of a row that repeats, where an
 * always-open panel would push every row below it off the screen. So the
 * panel is a popover: closed until it is asked for, and gone once it has
 * answered.
 */
function renderField(props: Partial<Parameters<typeof MonthField>[0]> = {}) {
  const onChange = vi.fn<(iso: string) => void>()
  const onBlur = vi.fn()
  const { rerender } = render(
    <MonthField
      id="cal-0"
      label="Fecha"
      value=""
      onChange={onChange}
      onBlur={onBlur}
      min="2026-08"
      max="2028-08"
      {...props}
    />,
  )
  return { onChange, onBlur, rerender }
}

const box = () => screen.getByRole('textbox', { name: /Fecha/ })
const toggle = (open: boolean) =>
  screen.getByRole('button', { name: open ? m.date_close_months() : m.date_open_months() })

describe('the month picker panel', () => {
  it('is not on the page until it is asked for', () => {
    renderField()
    expect(screen.queryByRole('group', { name: /Fecha/ })).not.toBeInTheDocument()
    expect(toggle(false)).toHaveAttribute('aria-expanded', 'false')
  })

  it('offers months, never days', () => {
    renderField()
    fireEvent.click(toggle(false))

    const panel = screen.getByRole('group', { name: /Fecha/ })
    expect(panel).toBeInTheDocument()
    // A month grid names its cells; a day grid would put a "1" among them.
    expect(screen.getByRole('button', { name: /^oct/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
  })

  it('reports the month picked as yyyy-mm and folds itself away', () => {
    const { onChange } = renderField()
    fireEvent.click(toggle(false))
    fireEvent.click(screen.getByRole('button', { name: /^oct/i }))

    expect(onChange).toHaveBeenCalledWith('2026-10')
    expect(screen.queryByRole('group', { name: /Fecha/ })).not.toBeInTheDocument()
  })

  it('steps out to the years rather than down to the days', () => {
    renderField()
    fireEvent.click(toggle(false))
    fireEvent.click(screen.getByRole('button', { name: m.date_pick_year() }))

    expect(screen.getByRole('button', { name: '2027' })).toBeInTheDocument()
    // Choosing a year is a way in, not the answer: it lands back on months.
    fireEvent.click(screen.getByRole('button', { name: '2027' }))
    expect(screen.getByRole('button', { name: /^oct/i })).toBeInTheDocument()
  })

  it('steps a year at a time, since a month grid holds a whole one', () => {
    renderField({ value: '2026-10' })
    fireEvent.click(toggle(false))
    expect(screen.getByRole('button', { name: m.date_pick_year() })).toHaveTextContent('2026')

    fireEvent.click(screen.getByRole('button', { name: m.date_next_year() }))
    expect(screen.getByRole('button', { name: m.date_pick_year() })).toHaveTextContent('2027')
  })

  /**
   * The year page was a fixed twenty-four, which is the right size for a date
   * of birth reaching back to 1930 and absurd here: three years are offered
   * and twenty-one dead cells are printed under them.
   */
  it('prints only the years the range actually holds', () => {
    renderField()
    fireEvent.click(toggle(false))
    fireEvent.click(screen.getByRole('button', { name: m.date_pick_year() }))

    expect(screen.getByRole('button', { name: '2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2028' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2029' })).not.toBeInTheDocument()
  })

  it('offers no page of years on either side when the range is one page', () => {
    renderField()
    fireEvent.click(toggle(false))
    fireEvent.click(screen.getByRole('button', { name: m.date_pick_year() }))

    expect(screen.getByRole('button', { name: m.date_prev_years() })).toBeDisabled()
    expect(screen.getByRole('button', { name: m.date_next_years() })).toBeDisabled()
  })

  it('closes on Escape and hands the focus back to the box', () => {
    renderField()
    fireEvent.click(toggle(false))
    fireEvent.keyDown(screen.getByRole('group', { name: /Fecha/ }), { key: 'Escape' })

    expect(screen.queryByRole('group', { name: /Fecha/ })).not.toBeInTheDocument()
    expect(box()).toHaveFocus()
  })

  it('closes when the focus leaves the widget altogether', () => {
    const { onBlur } = renderField()
    fireEvent.click(toggle(false))
    fireEvent.focusOut(toggle(true), { relatedTarget: document.body })

    expect(screen.queryByRole('group', { name: /Fecha/ })).not.toBeInTheDocument()
    expect(onBlur).toHaveBeenCalled()
  })

  it('stays open while the focus is still moving around inside the widget', () => {
    const { onBlur } = renderField()
    fireEvent.click(toggle(false))
    fireEvent.focusOut(box(), { relatedTarget: toggle(true) })

    expect(screen.getByRole('group', { name: /Fecha/ })).toBeInTheDocument()
    expect(onBlur).not.toHaveBeenCalled()
  })
})

describe('the month text box', () => {
  it('masks the digits into mm/yyyy and reports the month', () => {
    const { onChange } = renderField()
    fireEvent.change(box(), { target: { value: '102026' } })

    expect(box()).toHaveValue('10/2026')
    expect(onChange).toHaveBeenCalledWith('2026-10')
  })

  it('reports nothing while the month is still half typed', () => {
    const { onChange } = renderField()
    fireEvent.change(box(), { target: { value: '10' } })

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('refuses a month the grid would not have offered', () => {
    const { onChange } = renderField()
    fireEvent.change(box(), { target: { value: '012020' } })

    expect(onChange).toHaveBeenLastCalledWith('')
    expect(screen.getByText(m.date_month_past())).toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-invalid', 'true')
  })

  it('says so when the month typed does not exist', () => {
    renderField()
    fireEvent.change(box(), { target: { value: '132026' } })

    expect(screen.getByText(m.date_month_invalid())).toBeInTheDocument()
  })

  /**
   * The box that was here before took whatever was typed, so a half-finished
   * `11/206` at least reached the server as `11/206`. This one only ever
   * emits a whole month, which means the same keystrokes leave the reader
   * looking at a date the form does not have. It has to say so — but not
   * while they are still typing it.
   */
  it('says the month is unfinished once the reader has left it that way', () => {
    const { onChange } = renderField()
    fireEvent.change(box(), { target: { value: '11206' } })

    // Still mid-edit: nothing to complain about yet.
    expect(screen.queryByText(m.date_month_incomplete())).not.toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-invalid', 'false')

    fireEvent.focusOut(box(), { relatedTarget: document.body })
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(screen.getByText(m.date_month_incomplete())).toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-invalid', 'true')
  })

  it('stays quiet about a box left empty, which is a fair answer here', () => {
    renderField()
    fireEvent.focusOut(box(), { relatedTarget: document.body })

    expect(screen.queryByText(m.date_month_incomplete())).not.toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-invalid', 'false')
  })

  it('drops the complaint as soon as the reader goes back to typing', () => {
    renderField()
    fireEvent.change(box(), { target: { value: '11206' } })
    fireEvent.focusOut(box(), { relatedTarget: document.body })
    expect(screen.getByText(m.date_month_incomplete())).toBeInTheDocument()

    fireEvent.change(box(), { target: { value: '112026' } })
    expect(screen.queryByText(m.date_month_incomplete())).not.toBeInTheDocument()
  })

  it('prints a month that arrived from outside, a draft loading', () => {
    const { rerender } = renderField()
    expect(box()).toHaveValue('')

    rerender(
      <MonthField id="cal-0" label="Fecha" value="2027-03" onChange={vi.fn()} min="2026-08" max="2028-08" />,
    )
    expect(box()).toHaveValue('03/2027')
  })
})
