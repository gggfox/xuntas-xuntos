import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RegistrationFilters from '../../src/components/Admin/RegistrationFilters'
import { VIEWS, type Filters } from '../../src/lib/adminViews'

const ANY: Filters = VIEWS.all.filters

/**
 * jsdom lays nothing out, so every box measures 0×0 and `useModal` cannot
 * tell inside from outside. Giving the sheet a real rectangle is what makes
 * the backdrop a place a click can land.
 */
function measureDialog(rect: { top: number; left: number; width: number; height: number }) {
  const dialog = screen.getByRole('dialog')
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect)
  return dialog
}

describe('RegistrationFilters', () => {
  it('keeps the controls behind one button on a phone, and counts them', () => {
    const { unmount } = render(<RegistrationFilters value={ANY} onChange={() => {}} view="all" />)
    expect(screen.getByRole('button', { name: m.regs_filters() })).toBeInTheDocument()
    unmount()

    render(<RegistrationFilters value={{ ...ANY, branch: 'mens', minSections: 3 }} onChange={() => {}} view="all" />)
    expect(screen.getByRole('button', { name: m.regs_filters_active({ n: 2 }) })).toBeInTheDocument()
  })

  it('opens the sheet and writes a choice straight through', () => {
    const onChange = vi.fn()
    render(<RegistrationFilters value={ANY} onChange={onChange} view="all" />)
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters() }))

    const sheet = screen.getByRole('dialog')
    // Both arrangements are mounted — one is hidden by CSS jsdom does not
    // apply — so the sheet's own control is the one addressed here.
    const branch = sheet.querySelector<HTMLSelectElement>('#f-branch-stacked')!
    fireEvent.change(branch, { target: { value: 'mens' } })
    expect(onChange).toHaveBeenCalledWith({ ...ANY, branch: 'mens' })
  })

  it('hides the status control on a view that pins its own', () => {
    render(<RegistrationFilters value={VIEWS.pending.filters} onChange={() => {}} lockStatus view="pending" />)
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters_active({ n: 1 }) }))
    expect(screen.getByRole('dialog').querySelector('#f-status-stacked')).toBeNull()
  })

  it('clears back to the view’s own defaults', () => {
    const onChange = vi.fn()
    render(<RegistrationFilters value={{ ...ANY, notice: 'bounced' }} onChange={onChange} view="pending" />)
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters_active({ n: 1 }) }))
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters_clear() }))
    expect(onChange).toHaveBeenCalledWith(VIEWS.pending.filters)
  })

  it('closes on a click outside it', () => {
    render(<RegistrationFilters value={ANY} onChange={() => {}} view="all" />)
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters() }))
    const dialog = measureDialog({ top: 400, left: 0, width: 375, height: 400 })

    // Above the sheet's top edge: the scrim.
    fireEvent.mouseDown(dialog, { clientX: 180, clientY: 100 })
    fireEvent.click(dialog, { clientX: 180, clientY: 100 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stays open when the click only ends outside it', () => {
    render(<RegistrationFilters value={ANY} onChange={() => {}} view="all" />)
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters() }))
    const dialog = measureDialog({ top: 400, left: 0, width: 375, height: 400 })

    // A press that began on the sheet and drifted off it — selecting a label,
    // or a fumbled tap — is not a dismissal.
    fireEvent.mouseDown(dialog, { clientX: 180, clientY: 500 })
    fireEvent.click(dialog, { clientX: 180, clientY: 100 })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('stays open on a click inside it', () => {
    render(<RegistrationFilters value={ANY} onChange={() => {}} view="all" />)
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters() }))
    const dialog = measureDialog({ top: 400, left: 0, width: 375, height: 400 })

    fireEvent.mouseDown(dialog, { clientX: 180, clientY: 500 })
    fireEvent.click(dialog, { clientX: 180, clientY: 500 })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes on Listo', () => {
    render(<RegistrationFilters value={ANY} onChange={() => {}} view="all" />)
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters() }))
    fireEvent.click(screen.getByRole('button', { name: m.regs_filters_done() }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reports the dismissal even when no close event arrives', () => {
    // Not hypothetical: the browser this was verified in dispatches no
    // `close` event for any dialog. Without `useModal` reporting the
    // dismissal itself, the sheet stays mounted-but-closed and the button
    // that opens it goes dead — so this stubs the event away and asserts the
    // sheet can still be opened a second time.
    const silent = vi
      .spyOn(HTMLDialogElement.prototype, 'close')
      .mockImplementation(function (this: HTMLDialogElement) {
        this.open = false
      })
    try {
      render(<RegistrationFilters value={ANY} onChange={() => {}} view="all" />)
      const open = () => fireEvent.click(screen.getByRole('button', { name: m.regs_filters() }))

      open()
      fireEvent.click(screen.getByRole('button', { name: m.regs_filters_done() }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      open()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    } finally {
      silent.mockRestore()
    }
  })
})
