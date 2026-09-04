import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RegistrationsTable from '../../src/components/Admin/RegistrationsTable'
import type { AdminRow } from '../../src/lib/adminViews'

const rows: AdminRow[] = [
  {
    _id: 'a',
    status: 'submitted',
    submittedAt: 1,
    updatedAt: 1,
    name: 'Ana',
    email: 'a@x',
    branch: 'womens',
    state: 'NL',
    isMinor: true,
    guardianRequired: true,
    guardianConfirmed: false,
    sectionsComplete: 7,
    notice: null,
    decision: null,
  },
  {
    // Rejected + a pending notice is deliberately not this fixture's shape:
    // `batchable()` excludes rejections (they go out individually via
    // `sendRejection`), so a rejected row here would make the "one enabled
    // row" premise below false. `not_selected` is a real batch decision.
    _id: 'b',
    status: 'not_selected',
    submittedAt: 2,
    updatedAt: 2,
    name: 'Bea',
    email: 'b@x',
    branch: 'mens',
    state: 'JAL',
    isMinor: false,
    guardianRequired: false,
    guardianConfirmed: true,
    sectionsComplete: 5,
    notice: 'not_sent',
    decision: 'not_selected',
  },
]

describe('RegistrationsTable', () => {
  it('shows a word for every state, never only a colour', () => {
    render(
      <RegistrationsTable rows={rows} view="all" canSelect={false} selected={new Set()} onSelectedChange={() => {}} onOpen={() => {}} />,
    )
    expect(screen.getByText(m.status_submitted())).toBeInTheDocument()
    expect(screen.getByText(m.regs_guardian_pending())).toBeInTheDocument()
    expect(screen.getByText(m.notice_not_sent())).toBeInTheDocument()
    expect(screen.getByText(m.regs_sections({ n: 5, total: 7 }))).toBeInTheDocument()
  })

  it('opens a row', () => {
    const onOpen = vi.fn()
    render(
      <RegistrationsTable rows={rows} view="all" canSelect={false} selected={new Set()} onSelectedChange={() => {}} onOpen={onOpen} />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: m.regs_open() })[0])
    expect(onOpen).toHaveBeenCalledWith('a')
  })

  it('selects only batchable rows when allowed', () => {
    const onSelectedChange = vi.fn()
    render(
      <RegistrationsTable rows={rows} view="all" canSelect selected={new Set()} onSelectedChange={onSelectedChange} onOpen={() => {}} />,
    )
    const boxes = screen.getAllByRole('checkbox')
    // header + one enabled row (Bea); Ana has no pending notice.
    expect(boxes.filter((b) => !(b as HTMLInputElement).disabled)).toHaveLength(2)
    fireEvent.click(screen.getByRole('checkbox', { name: m.regs_select_all() }))
    expect(onSelectedChange).toHaveBeenCalledWith(new Set(['b']))
  })
})
