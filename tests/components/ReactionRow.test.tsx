import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

const react = vi.fn(async () => ({ on: true }))

vi.mock('convex/react', () => ({
  useMutation: () => react,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { pip: { react: 'pip:react' } },
}))

const { default: ReactionRow, QUICK_EMOJI, recentEmoji, rememberEmoji } = await import('../../src/components/Pip/ReactionRow')

beforeEach(() => {
  react.mockClear()
  window.localStorage.clear()
})

describe('ReactionRow', () => {
  it('draws each reaction as a pressed or unpressed chip with its count', () => {
    render(<ReactionRow targetKind="post" targetId="p1" reactions={[{ emoji: '🔥', count: 7, mine: true }, { emoji: '💪', count: 4, mine: false }]} />)
    expect(screen.getByRole('button', { name: m.pip_reaction_mine({ emoji: '🔥', n: 7 }) })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: m.pip_reaction({ emoji: '💪', n: 4 }) })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles a chip through the mutation', () => {
    render(<ReactionRow targetKind="post" targetId="p1" reactions={[{ emoji: '🔥', count: 7, mine: true }]} />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_reaction_mine({ emoji: '🔥', n: 7 }) }))
    expect(react).toHaveBeenCalledWith({ targetKind: 'post', targetId: 'p1', emoji: '🔥' })
  })

  it('opens a picker with recents first and every emoji behind it, and remembers what was picked', () => {
    render(<ReactionRow targetKind="comment" targetId="c1" reactions={[]} />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_react() }))
    expect(screen.getByText(m.pip_recent_emoji())).toBeInTheDocument()
    expect(screen.getByText(m.pip_only_lead_sees_who())).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '🧠' }))
    expect(react).toHaveBeenCalledWith({ targetKind: 'comment', targetId: 'c1', emoji: '🧠' })
    expect(recentEmoji()[0]).toBe('🧠')
    expect(screen.queryByText(m.pip_recent_emoji())).toBeNull()
  })

  it('keeps five recents, newest first, seeded from the quick row', () => {
    expect(recentEmoji()).toEqual(QUICK_EMOJI)
    rememberEmoji('🎯')
    rememberEmoji('🧠')
    rememberEmoji('🎯')
    expect(recentEmoji()).toEqual(['🎯', '🧠', ...QUICK_EMOJI].slice(0, 5))
  })

  it('shows a message when the reaction is refused', async () => {
    react.mockRejectedValueOnce(new Error('x'))
    render(<ReactionRow targetKind="post" targetId="p1" reactions={[{ emoji: '🔥', count: 7, mine: true }]} />)
    fireEvent.click(screen.getByRole('button', { name: m.pip_reaction_mine({ emoji: '🔥', n: 7 }) }))
    await waitFor(() => expect(screen.getByText(m.err_generic())).toBeInTheDocument())
  })
})
