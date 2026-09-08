import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import EntryDialog from '../../src/components/Journal/EntryDialog'

function renderDialog(initial?: Parameters<typeof EntryDialog>[0]['initial']) {
  const onSubmit = vi.fn(async () => {})
  const onClose = vi.fn()
  render(<EntryDialog initial={initial} onSubmit={onSubmit} onClose={onClose} />)
  return { onSubmit, onClose }
}

describe('EntryDialog', () => {
  it('asks for a score on a tournament and hides it for a session', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: m.journal_new_entry() })).toBeInTheDocument()
    expect(screen.getByLabelText(m.journal_field_score())).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: m.journal_kind_training() }))
    expect(screen.queryByLabelText(m.journal_field_score())).not.toBeInTheDocument()
  })

  it('refuses an empty entry from the same rules the server runs, without calling up', () => {
    const { onSubmit } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: m.journal_save() }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(m.err_entry_title_required())).toBeInTheDocument()
  })

  it('hands up what was typed and closes', async () => {
    const { onSubmit, onClose } = renderDialog()
    fireEvent.change(screen.getByLabelText(/Torneo o sesión|Tournament or session/), { target: { value: 'Copa Regional' } })
    // The date box is masked and locale-ordered (tests run in English, so
    // month first); a typed day is what the field emits.
    fireEvent.change(screen.getByPlaceholderText(m.date_placeholder()), { target: { value: '09/05/2026' } })
    fireEvent.change(screen.getByLabelText(m.journal_field_score()), { target: { value: '71-74' } })
    fireEvent.change(screen.getByLabelText(/Tu reflexión|Your reflection/), { target: { value: 'Salí tenso.' } })
    fireEvent.click(screen.getByRole('button', { name: m.journal_save() }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'tournament',
        title: 'Copa Regional',
        date: '2026-09-05',
        body: 'Salí tenso.',
        score: '71-74',
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('opens on the entry being edited', () => {
    renderDialog({ kind: 'training', title: 'Juego corto', date: '2026-09-01', body: 'Bunker.', score: undefined })
    expect(screen.getByRole('dialog', { name: m.journal_edit_entry() })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: m.journal_kind_training() })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByDisplayValue('Juego corto')).toBeInTheDocument()
  })
})
