import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

vi.mock('convex/react', () => ({
  useQuery: () => ({ canComment: true, comments: [] }),
  useMutation: () => vi.fn(async () => ({ ok: true })),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { pip: { comments: 'pip:comments', addComment: 'pip:addComment', deleteComment: 'pip:deleteComment', react: 'pip:react' } },
}))

const { default: PostCard } = await import('../../src/components/Pip/PostCard')

const post = (over: Record<string, unknown>) => ({
  _id: 'p1',
  kind: 'session' as const,
  title: 'Office hours de septiembre',
  body: 'Sesión en vivo para platicar los videos.\n\nEntra por aquí: https://zoom.us/j/000000001\n\nTrae una situación concreta.',
  authorName: 'Mtra. Renata Fuentes',
  publishedAt: Date.parse('2026-09-10T14:00:00.000Z'),
  commentsVisibility: 'lead' as const,
  attachments: [
    { type: 'youtube' as const, videoId: 'dQw4w9WgXcQ', unavailable: false },
    { type: 'image' as const, url: 'https://files.example/h.png', name: 'Hoja' },
  ],
  reactions: [{ emoji: '🙌', count: 5, mine: false }],
  commentCount: 0,
  ...over,
})

describe('PostCard', () => {
  it('collapsed: kind, date, title, three lines of prose, the attachment summary, reactions, and the comments link', () => {
    const onToggle = vi.fn()
    render(<PostCard post={post({})} open={false} onToggle={onToggle} />)
    expect(screen.getByText(m.pip_kind_session())).toBeInTheDocument()
    expect(screen.getByText('Office hours de septiembre')).toBeInTheDocument()
    expect(screen.getByText(/Sesión en vivo para platicar/)).toBeInTheDocument()
    expect(screen.getByText(m.pip_videos_one())).toBeInTheDocument()
    expect(screen.getByText(m.pip_images_one())).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.pip_reaction({ emoji: '🙌', n: 5 }) })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: m.pip_comments_lead_none() }))
    expect(onToggle).toHaveBeenCalled()
    expect(screen.queryByText(m.pip_zoom())).toBeNull()
  })

  it('open: the body, the Zoom card, the tiles, and the thread', () => {
    render(<PostCard post={post({})} open onToggle={() => {}} />)
    expect(screen.getByText(/Trae una situación concreta/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: m.pip_zoom_enter() })).toHaveAttribute('href', 'https://zoom.us/j/000000001')
    expect(screen.getAllByRole('button', { name: /Abrir:|Open:/ })).toHaveLength(2)
    expect(screen.getByText(m.pip_visibility_lead())).toBeInTheDocument()
  })

  it('says comments are off, and marks an edited post', () => {
    render(<PostCard post={post({ commentsVisibility: 'off', editedAt: 1 })} open onToggle={() => {}} />)
    expect(screen.getByText(m.pip_visibility_off())).toBeInTheDocument()
    expect(screen.getByText(`· ${m.pip_edited()}`)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('names the comment count for a group thread', () => {
    render(<PostCard post={post({ commentsVisibility: 'group', commentCount: 3 })} open={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: m.pip_comments_n({ n: 3 }) })).toBeInTheDocument()
  })
})
