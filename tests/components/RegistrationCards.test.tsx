import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RegistrationCards from '../../src/components/Admin/RegistrationCards'
import type { AdminRow } from '../../src/lib/adminViews'

/** Same shape as the table's fixture, so the two can be compared directly. */
const rows: AdminRow[] = [
  {
    _id: 'a',
    status: 'submitted',
    submittedAt: 2,
    updatedAt: 2,
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
    _id: 'b',
    status: 'not_selected',
    submittedAt: 1,
    updatedAt: 1,
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

const noop = () => {}

describe('RegistrationCards', () => {
  it('shows a word for every state, never only a colour', () => {
    render(<RegistrationCards rows={rows} view="all" canSelect={false} selected={new Set()} onSelectedChange={noop} onOpen={noop} />)
    expect(screen.getByText(m.status_submitted())).toBeInTheDocument()
    expect(screen.getByText(m.regs_guardian_pending())).toBeInTheDocument()
    expect(screen.getByText(m.notice_not_sent())).toBeInTheDocument()
    // The card runs branch, sections and date together on one mono line, so
    // this is a substring of that line rather than a node of its own.
    expect(screen.getByText(new RegExp(m.regs_sections({ n: 5, total: 7 })))).toBeInTheDocument()
  })

  it('makes the whole card the way in, not a button inside it', () => {
    const onOpen = vi.fn()
    render(<RegistrationCards rows={rows} view="all" canSelect={false} selected={new Set()} onSelectedChange={noop} onOpen={onOpen} />)
    // No per-row "Abrir": the card is the target.
    expect(screen.queryByRole('button', { name: m.regs_open() })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }))
    expect(onOpen).toHaveBeenCalledWith('a')
  })

  it('opens in the view’s own order, the same as the table does', () => {
    // `all` sorts by name ascending; `pending` by submittedAt ascending, which
    // puts Bea (1) before Ana (2). A card list has no header to click, so the
    // order it opens in is the only order it has.
    const { unmount } = render(
      <RegistrationCards rows={rows} view="all" canSelect={false} selected={new Set()} onSelectedChange={noop} onOpen={noop} />,
    )
    expect(screen.getAllByRole('listitem').map((li) => li.textContent?.slice(0, 3))).toEqual(['Ana', 'Bea'])
    unmount()

    render(<RegistrationCards rows={rows} view="pending" canSelect={false} selected={new Set()} onSelectedChange={noop} onOpen={noop} />)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent?.slice(0, 3))).toEqual(['Bea', 'Ana'])
  })

  it('offers a checkbox only where a batch can act, and only on rows it can act on', () => {
    const onSelectedChange = vi.fn()
    const { unmount } = render(
      <RegistrationCards rows={rows} view="all" canSelect selected={new Set()} onSelectedChange={onSelectedChange} onOpen={noop} />,
    )
    // Ana carries no notice, so `batchable()` excludes her.
    expect(screen.getByRole('checkbox', { name: 'Ana' })).toBeDisabled()
    const bea = screen.getByRole('checkbox', { name: 'Bea' })
    expect(bea).toBeEnabled()
    fireEvent.click(bea)
    expect(onSelectedChange).toHaveBeenCalledWith(new Set(['b']))
    unmount()

    // `pending` is not a selectable view — nothing to tick at all.
    render(<RegistrationCards rows={rows} view="pending" canSelect selected={new Set()} onSelectedChange={noop} onOpen={noop} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('says so when the filters have emptied it', () => {
    render(<RegistrationCards rows={[]} view="all" canSelect={false} selected={new Set()} onSelectedChange={noop} onOpen={noop} />)
    expect(screen.getByText(m.regs_none())).toBeInTheDocument()
    expect(screen.getByText(m.regs_count({ n: 0 }))).toBeInTheDocument()
  })
})
