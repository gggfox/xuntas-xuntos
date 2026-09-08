import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

let thread: unknown
const add = vi.fn(async () => ({ id: 'c9' }))
const remove = vi.fn(async () => ({ ok: true }))

vi.mock('convex/react', () => ({
  useQuery: () => thread,
  useMutation: (fn: string) => (fn === 'journal:addComment' ? add : remove),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { journal: { comments: 'journal:comments', addComment: 'journal:addComment', deleteComment: 'journal:deleteComment' } },
}))

const { default: CommentThread } = await import('../../src/components/Journal/CommentThread')

const comments = [
  { _id: 'c1', body: 'Buen manejo del driver.', createdAt: 0, authorName: 'Luisa', authorRoles: ['coach'], isAthlete: false, isMine: false },
  { _id: 'c2', body: 'Gracias.', createdAt: 1, authorName: 'Regina', authorRoles: [], isAthlete: true, isMine: true },
]

beforeEach(() => {
  add.mockClear()
  remove.mockClear()
})

describe('CommentThread', () => {
  it('draws the thread with each author\'s role, and a delete only on the reader\'s own', () => {
    thread = { canComment: true, comments }
    render(<CommentThread athleteUserId={'a1' as never} />)
    expect(screen.getByText('Buen manejo del driver.')).toBeInTheDocument()
    expect(screen.getByText(m.role_coach())).toBeInTheDocument()
    expect(screen.getByText(m.journal_role_athlete())).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: m.common_delete() })).toHaveLength(1)
  })

  it('shows no box when the server says the reader may not write', () => {
    thread = { canComment: false, comments }
    render(<CommentThread athleteUserId={'a1' as never} />)
    expect(screen.queryByRole('button', { name: m.journal_comment_send() })).not.toBeInTheDocument()
  })

  it('refuses an empty comment locally and sends a real one', async () => {
    thread = { canComment: true, comments: [] }
    render(<CommentThread athleteUserId={'a1' as never} entryId={'e1' as never} />)
    fireEvent.click(screen.getByRole('button', { name: m.journal_comment_send() }))
    expect(add).not.toHaveBeenCalled()
    expect(screen.getByText(m.err_comment_required())).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(m.journal_comment_label()), { target: { value: '  Sigue así.  ' } })
    fireEvent.click(screen.getByRole('button', { name: m.journal_comment_send() }))
    await waitFor(() => expect(add).toHaveBeenCalledWith({ athleteUserId: 'a1', entryId: 'e1', body: 'Sigue así.' }))
  })

  it('deletes only what is the reader\'s own', () => {
    thread = { canComment: true, comments }
    render(<CommentThread athleteUserId={'a1' as never} />)
    fireEvent.click(screen.getByRole('button', { name: m.common_delete() }))
    expect(remove).toHaveBeenCalledWith({ id: 'c2' })
  })
})
