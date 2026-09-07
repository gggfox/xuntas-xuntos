import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import AthletesTable from '../../src/components/Admin/AthletesTable'
import AthleteCards from '../../src/components/Admin/AthleteCards'

const rows = [
  { _id: 'a1', name: 'Regina Ontiveros', branch: 'womens' as const, entryCount: 3, lastEntryDate: '2026-08-02', staff: [{ name: 'Luisa', roles: ['coach'] }] },
  { _id: 'a2', name: 'Diego Barrera', branch: 'mens' as const, entryCount: 0, staff: [] },
  { _id: 'a3', name: 'Ana Ruiz', branch: 'womens' as const, entryCount: 5, lastEntryDate: '2026-09-01', staff: [] },
]

describe('AthletesTable', () => {
  it('opens on the newest writing, with those who never wrote last', () => {
    render(<AthletesTable rows={rows} showStaff={false} onOpen={() => {}} />)
    const names = screen.getAllByRole('row').slice(1).map((r) => r.querySelector('td')?.textContent)
    expect(names).toEqual(['Ana Ruiz', 'Regina Ontiveros', 'Diego Barrera'])
    expect(screen.getByText(m.athletes_no_entries())).toBeInTheDocument()
  })

  it('draws the team column for administration only', () => {
    render(<AthletesTable rows={rows} showStaff onOpen={() => {}} />)
    expect(screen.getByText(m.athletes_col_staff())).toBeInTheDocument()
    expect(screen.getByText('Luisa')).toBeInTheDocument()
    expect(screen.getByText(m.role_coach())).toBeInTheDocument()
  })

  it('hides the team column from a coach', () => {
    render(<AthletesTable rows={rows} showStaff={false} onOpen={() => {}} />)
    expect(screen.queryByText(m.athletes_col_staff())).not.toBeInTheDocument()
  })

  it('opens a row', () => {
    const onOpen = vi.fn()
    render(<AthletesTable rows={rows} showStaff={false} onOpen={onOpen} />)
    fireEvent.click(screen.getAllByRole('button', { name: m.regs_open() })[0])
    expect(onOpen).toHaveBeenCalledWith('a3')
  })
})

describe('AthleteCards', () => {
  it('keeps the table\'s order and makes the whole card the target', () => {
    const onOpen = vi.fn()
    render(<AthleteCards rows={rows} onOpen={onOpen} />)
    const cards = screen.getAllByRole('button')
    expect(cards.map((c) => c.querySelector('b')?.textContent)).toEqual(['Ana Ruiz', 'Regina Ontiveros', 'Diego Barrera'])
    fireEvent.click(cards[2])
    expect(onOpen).toHaveBeenCalledWith('a2')
    expect(screen.getByText(m.athletes_count({ n: 3 }))).toBeInTheDocument()
  })
})
