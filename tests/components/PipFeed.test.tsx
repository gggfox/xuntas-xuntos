import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

let paged: { results: unknown[]; status: string; loadMore: ReturnType<typeof vi.fn> }
let lastArgs: unknown
let months: unknown

vi.mock('convex/react', () => ({
  usePaginatedQuery: (_fn: unknown, args: unknown) => {
    lastArgs = args
    return paged
  },
  useQuery: (fn: string) => (fn === 'pip:months' ? months : fn === 'pip:post' ? null : { canComment: false, comments: [] }),
  useMutation: () => vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { pip: { feed: 'pip:feed', months: 'pip:months', post: 'pip:post', comments: 'pip:comments', addComment: 'pip:addComment', deleteComment: 'pip:deleteComment', react: 'pip:react' } },
}))

const { default: PipFeed } = await import('../../src/components/Pip/PipFeed')

const post = (over: Record<string, unknown>) => ({
  _id: 'p1',
  kind: 'challenge',
  title: 'Reto de 7 días',
  body: 'Un solo cambio.',
  authorName: 'Renata',
  publishedAt: Date.parse('2026-09-12T15:00:00.000Z'),
  commentsVisibility: 'group',
  attachments: [],
  reactions: [],
  commentCount: 0,
  ...over,
})

beforeEach(() => {
  paged = { results: [], status: 'Exhausted', loadMore: vi.fn() }
  months = [{ key: '2026-09', count: 2 }, { key: '2026-08', count: 1 }]
})

describe('PipFeed', () => {
  it('says the feed is empty', () => {
    render(<PipFeed />)
    expect(screen.getByText(m.pip_empty())).toBeInTheDocument()
  })

  it('groups posts under month headers, newest first, and opens the first one', () => {
    paged = {
      results: [post({}), post({ _id: 'p2', title: 'Office hours', publishedAt: Date.parse('2026-09-10T15:00:00.000Z') }), post({ _id: 'p3', title: 'Bienvenida', publishedAt: Date.parse('2026-08-03T15:00:00.000Z') })],
      status: 'Exhausted',
      loadMore: vi.fn(),
    }
    render(<PipFeed />)
    const headers = screen.getAllByRole('heading', { level: 2 })
    // jsdom's `navigator.language` is always `en-US`, so `getLocale()`
    // resolves to English under test regardless of the app's own locale
    // strategy — the same reason `RangeField.test.tsx` and
    // `JournalFeed.test.tsx` match either language rather than one exact
    // string.
    expect(headers[0]?.textContent).toMatch(/septiembre 2026|September 2026/)
    expect(headers[1]?.textContent).toMatch(/agosto 2026|August 2026/)
    // The reaction "+" buttons also carry `aria-expanded`, so the toggle is
    // found by its position as the article's direct child, not by name —
    // every card's disclosure announces the post's own title, not a
    // generic "expand"/"collapse" (finding 4 of the final review).
    expect(document.querySelectorAll('article > button[aria-expanded="true"]')).toHaveLength(1)
    expect(document.querySelectorAll('article > button[aria-expanded="false"]')).toHaveLength(2)
  })

  it('offers the months with their counts and asks the server for the chosen one', () => {
    render(<PipFeed />)
    const select = screen.getByLabelText(m.pip_month_label())
    expect(select.textContent).toMatch(/Septiembre 2026 · 2|September 2026 · 2/)
    fireEvent.change(select, { target: { value: '2026-08' } })
    expect(lastArgs).toMatchObject({ month: '2026-08' })
  })

  it('filters by kind through the server too', () => {
    render(<PipFeed />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_kind_challenge() }))
    expect(lastArgs).toMatchObject({ kind: 'challenge' })
    fireEvent.click(screen.getByRole('button', { name: m.pip_kind_all() }))
    expect(lastArgs).not.toMatchObject({ kind: 'challenge' })
  })

  it('opens the post a notification pointed at', () => {
    paged = { results: [post({}), post({ _id: 'p2', title: 'Office hours' })], status: 'Exhausted', loadMore: vi.fn() }
    render(<PipFeed focusPostId="p2" />)
    const open = document.querySelector('article > button[aria-expanded="true"]')
    expect(open?.closest('article')?.id).toBe('post-p2')
  })

  it('asks for more when there is more', () => {
    paged = { results: [post({})], status: 'CanLoadMore', loadMore: vi.fn() }
    render(<PipFeed />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_load_more() }))
    expect(paged.loadMore).toHaveBeenCalled()
  })
})
