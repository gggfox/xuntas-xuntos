import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

let thread: unknown
const add = vi.fn(async () => ({ id: 'c9' }))
const remove = vi.fn(async () => ({ ok: true }))
const react = vi.fn(async () => ({ on: true }))

vi.mock('convex/react', () => ({
  useQuery: () => thread,
  useMutation: (fn: string) => (fn === 'pip:addComment' ? add : fn === 'pip:deleteComment' ? remove : react),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { pip: { comments: 'pip:comments', addComment: 'pip:addComment', deleteComment: 'pip:deleteComment', react: 'pip:react' } },
}))

const { default: PostThread } = await import('../../src/components/Pip/PostThread')

const comment = (over: Record<string, unknown>) => ({
  _id: 'c1',
  authorName: 'Marcelo Treviño',
  isLead: false,
  isMine: false,
  inactive: false,
  body: 'Acepto. El driver es donde más me acelero.',
  createdAt: 0,
  visibility: 'group',
  hidden: false,
  reactions: [],
  replies: [],
  ...over,
})

beforeEach(() => {
  add.mockClear()
  remove.mockClear()
})

describe('PostThread', () => {
  it('says what the thread is for and who reads it, and offers the composer when allowed', () => {
    thread = { canComment: true, comments: [] }
    render(<PostThread postId="p1" commentsVisibility="lead" />)
    expect(screen.getByText(m.pip_visibility_lead())).toBeInTheDocument()
    expect(screen.getByPlaceholderText(m.pip_compose_lead())).toBeInTheDocument()
    expect(screen.getByText(m.pip_no_comments_lead())).toBeInTheDocument()
  })

  it('shows no composer when the server says the reader may not write', () => {
    thread = { canComment: false, comments: [comment({})] }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Acepto. El driver es donde más me acelero.')).toBeInTheDocument()
  })

  it('draws the lead\'s pill, the inactive dot, the hidden mark, and the private mark', () => {
    thread = {
      canComment: true,
      comments: [
        comment({ replies: [comment({ _id: 'r1', authorName: 'Mtra. Renata Fuentes', isLead: true, body: 'Perfecto.' })] }),
        comment({ _id: 'c2', authorName: 'Sofía Lozano', inactive: true, body: 'Yo lo hice en el Regional.' }),
        comment({ _id: 'c3', isMine: true, hidden: true, body: 'Retirado.' }),
        comment({ _id: 'c4', isMine: true, visibility: 'lead', body: 'En privado.' }),
      ],
    }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    expect(screen.getByText(m.pip_lead_pill())).toBeInTheDocument()
    expect(screen.getByText(m.pip_inactive_member())).toBeInTheDocument()
    expect(screen.getByText(m.pip_comment_hidden())).toBeInTheDocument()
    expect(screen.queryByText('Retirado.')).toBeNull()
    expect(screen.getByText(`· ${m.pip_written_private()}`)).toBeInTheDocument()
  })

  it('sends a comment, and a reply under its parent', async () => {
    thread = { canComment: true, comments: [comment({})] }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    fireEvent.change(screen.getByPlaceholderText(m.pip_compose_group()), { target: { value: 'Semana hecha.' } })
    fireEvent.click(screen.getByRole('button', { name: m.pip_comment_send() }))
    await waitFor(() => expect(add).toHaveBeenCalledWith({ postId: 'p1', body: 'Semana hecha.' }))

    fireEvent.click(screen.getByRole('button', { name: m.pip_reply() }))
    fireEvent.change(screen.getByPlaceholderText(m.pip_reply_placeholder()), { target: { value: 'Yo también.' } })
    fireEvent.click(screen.getAllByRole('button', { name: m.pip_comment_send() })[0])
    await waitFor(() => expect(add).toHaveBeenCalledWith({ postId: 'p1', body: 'Yo también.', parentId: 'c1' }))
  })

  it('keeps one reply box open at a time', () => {
    thread = { canComment: true, comments: [comment({}), comment({ _id: 'c2', body: 'Otro.' })] }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    const replies = screen.getAllByRole('button', { name: m.pip_reply() })
    fireEvent.click(replies[0])
    fireEvent.click(replies[1])
    expect(screen.getAllByPlaceholderText(m.pip_reply_placeholder())).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: m.pip_reply_cancel() })).toHaveLength(1)
  })

  it('offers delete only on the reader\'s own comments without replies or reactions', () => {
    thread = {
      canComment: true,
      comments: [
        comment({ isMine: true }),
        comment({ _id: 'c2', isMine: true, replies: [comment({ _id: 'r' })] }),
        comment({ _id: 'c3', isMine: true, reactions: [{ emoji: '🔥', count: 1, mine: false }] }),
        comment({ _id: 'c4' }),
      ],
    }
    render(<PostThread postId="p1" commentsVisibility="group" />)
    expect(screen.getAllByRole('button', { name: m.common_delete() })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: m.common_delete() }))
    expect(remove).toHaveBeenCalledWith({ id: 'c1' })
  })
})
