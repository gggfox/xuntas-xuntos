import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import AssignDialog from '../../src/components/Admin/AssignDialog'

const members = [
  { _id: 'a1', name: 'Regina Ontiveros', branch: 'womens' as const },
  { _id: 'a2', name: 'Diego Barrera', branch: 'mens' as const },
  { _id: 'a3', name: 'Ana María Ruiz', branch: 'womens' as const },
]

function renderDialog(current: string[] = ['a1']) {
  const onSave = vi.fn(async () => {})
  const onClose = vi.fn()
  render(<AssignDialog staffName="Luisa" members={members} current={current} onSave={onSave} onClose={onClose} />)
  return { onSave, onClose }
}

describe('AssignDialog', () => {
  it('lists every member with the current ones ticked', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: m.assign_title({ name: 'Luisa' }) })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Regina/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Diego/ })).not.toBeChecked()
    expect(screen.getByText(m.assign_count({ n: 1 }))).toBeInTheDocument()
  })

  it('saves the whole list as it stands, in roster order', async () => {
    const { onSave, onClose } = renderDialog()
    fireEvent.click(screen.getByRole('checkbox', { name: /Diego/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Regina/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Ana María/ }))
    fireEvent.click(screen.getByRole('button', { name: m.assign_save() }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['a2', 'a3']))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('cancels without saving', () => {
    const { onSave, onClose } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: m.staff_cancel() }))
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('says when there is nobody to assign yet', () => {
    render(<AssignDialog staffName="Luisa" members={[]} current={[]} onSave={async () => {}} onClose={() => {}} />)
    expect(screen.getByText(m.assign_none())).toBeInTheDocument()
  })
})
