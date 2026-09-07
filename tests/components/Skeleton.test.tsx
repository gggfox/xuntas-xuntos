import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import { Lines, TextLine } from '../../src/components/Skeleton'
import PageSkeleton from '../../src/components/PageSkeleton'
import TableSkeleton, { CardsSkeleton } from '../../src/components/Admin/TableSkeleton'

/**
 * A skeleton is decoration around one sentence: the bars are hidden from
 * assistive tech and the "Cargando…" that used to be the whole loading
 * screen is still there, as a status a screen reader announces.
 */
describe('skeletons', () => {
  it('a table skeleton keeps the loading sentence as a status and draws twelve rows', () => {
    render(<TableSkeleton columns={['check', 'text', 'text', 'chip', 'mono', 'chip', 'chip', 'date', 'button']} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(m.common_loading())
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status.querySelectorAll('tbody tr')).toHaveLength(12)
    expect(status.querySelectorAll('tbody td')).toHaveLength(12 * 9)
    // Nothing but the sentence reaches the accessibility tree: no rows, no
    // cells, no bars.
    expect(within(status).queryAllByRole('row')).toHaveLength(0)
    expect(status.querySelectorAll('.bone:not([aria-hidden="true"])')).toHaveLength(0)
  })

  it('a card list skeleton draws four cards below md', () => {
    render(<CardsSkeleton />)
    const status = screen.getByRole('status')
    expect(status.querySelectorAll('li')).toHaveLength(4)
    expect(within(status).queryAllByRole('listitem')).toHaveLength(0)
    expect(status).toHaveTextContent(m.common_loading())
  })

  it('a page skeleton is a main with the sentence, and can still name the review date', () => {
    render(<PageSkeleton reviewOnText="4 de octubre" />)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(m.common_loading())
    expect(screen.getByText(m.done_review({ date: '4 de octubre' }))).toBeInTheDocument()
  })

  it('lines and an inline line each carry the sentence', () => {
    render(
      <>
        <Lines n={3} />
        <p>
          <TextLine />
        </p>
      </>
    )
    const statuses = screen.getAllByRole('status')
    expect(statuses).toHaveLength(2)
    for (const s of statuses) expect(s).toHaveTextContent(m.common_loading())
  })
})
