import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

let paged: { results: unknown[]; status: string; loadMore: ReturnType<typeof vi.fn> }
let lastArgs: unknown
let focusedEntry: unknown

vi.mock('convex/react', () => ({
  usePaginatedQuery: (_fn: unknown, args: unknown) => {
    lastArgs = args
    return paged
  },
  useQuery: (fn: string) => (fn === 'journal:entry' ? focusedEntry : { canComment: false, comments: [] }),
  useMutation: () => vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    journal: {
      entries: 'journal:entries',
      entry: 'journal:entry',
      comments: 'journal:comments',
      addComment: 'journal:addComment',
      deleteComment: 'journal:deleteComment',
      updateEntry: 'journal:updateEntry',
      deleteEntry: 'journal:deleteEntry',
    },
  },
}))

const { default: JournalFeed } = await import('../../src/components/Journal/JournalFeed')

const entry = (over: Record<string, unknown>) => ({
  _id: 'e1',
  athleteUserId: 'a1',
  kind: 'tournament',
  title: 'Copa Regional',
  date: '2026-09-05',
  body: 'Salí tenso.',
  score: '71-74-70',
  createdAt: 0,
  commentCount: 0,
  ...over,
})

beforeEach(() => {
  paged = { results: [], status: 'Exhausted', loadMore: vi.fn() }
  focusedEntry = undefined
})

describe('JournalFeed', () => {
  it('says the journal is empty', () => {
    render(<JournalFeed athleteUserId={'a1' as never} canEdit />)
    expect(screen.getByText(m.journal_empty())).toBeInTheDocument()
  })

  it('draws entries with their kind, date, score, and the comment count', () => {
    paged = { results: [entry({}), entry({ _id: 'e2', kind: 'training', title: 'Juego corto', score: undefined, commentCount: 2 })], status: 'Exhausted', loadMore: vi.fn() }
    render(<JournalFeed athleteUserId={'a1' as never} canEdit />)
    expect(screen.getByText('Copa Regional')).toBeInTheDocument()
    expect(screen.getByText('71-74-70')).toBeInTheDocument()
    expect(screen.getByText(m.journal_kind_training())).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.journal_comments_n({ n: 2 }) })).toBeInTheDocument()
  })

  /** An entry with words under it stays: the button is not offered rather than refused. */
  it('offers delete only on the athlete\'s own uncommented entries', () => {
    paged = { results: [entry({}), entry({ _id: 'e2', commentCount: 1 })], status: 'Exhausted', loadMore: vi.fn() }
    render(<JournalFeed athleteUserId={'a1' as never} canEdit />)
    expect(screen.getAllByRole('button', { name: m.common_delete() })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: m.journal_edit() })).toHaveLength(2)
  })

  it('offers no edit controls to a reader who is not the athlete', () => {
    paged = { results: [entry({})], status: 'Exhausted', loadMore: vi.fn() }
    render(<JournalFeed athleteUserId={'a1' as never} canEdit={false} />)
    expect(screen.queryByRole('button', { name: m.journal_edit() })).not.toBeInTheDocument()
  })

  it('offers a button to load more while there is more, for readers without a scroll', () => {
    const loadMore = vi.fn()
    paged = { results: [entry({})], status: 'CanLoadMore', loadMore }
    render(<JournalFeed athleteUserId={'a1' as never} canEdit />)
    fireEvent.click(screen.getByRole('button', { name: m.journal_load_more() }))
    expect(loadMore).toHaveBeenCalledWith(50)
  })

  it('re-runs the query with the typed range', () => {
    render(<JournalFeed athleteUserId={'a1' as never} canEdit />)
    expect(lastArgs).toEqual({ athleteUserId: 'a1', from: undefined, to: undefined })
    // Month first: the tests run in English.
    fireEvent.change(screen.getByLabelText(m.range_start()), { target: { value: '08/01/2026' } })
    expect(lastArgs).toEqual({ athleteUserId: 'a1', from: '2026-08-01', to: undefined })
  })

  it('leads with the entry a notification pointed at, thread open', () => {
    focusedEntry = entry({ _id: 'e9', title: 'La que buscaba' })
    paged = { results: [entry({}), entry({ _id: 'e9', title: 'La que buscaba' })], status: 'Exhausted', loadMore: vi.fn() }
    render(<JournalFeed athleteUserId={'a1' as never} canEdit focusEntryId="e9" />)
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['La que buscaba', 'Copa Regional'])
    expect(screen.getByText(m.journal_no_comments())).toBeInTheDocument()
  })
})
