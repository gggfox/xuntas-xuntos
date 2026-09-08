import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import NotificationBell from '../../src/components/AppBar/NotificationBell'
import { sentenceFor, type NotificationView } from '../../src/components/Notifications/NotificationItem'

const rows: NotificationView[] = [
  { _id: 'n1', kind: 'entry_comment', userId: 'a1', athleteId: 'a1', entryId: 'e1', createdAt: 0, actorName: 'Luisa', athleteName: 'Regina', entryTitle: 'Copa Regional' },
  { _id: 'n2', kind: 'entry_created', userId: 'c1', athleteId: 'a1', entryId: 'e2', createdAt: 0, readAt: 5, actorName: 'Regina', athleteName: 'Regina', entryTitle: 'Juego corto' },
]

function renderBell(over: Partial<React.ComponentProps<typeof NotificationBell>> = {}) {
  const onOpen = vi.fn()
  const onMarkAll = vi.fn()
  const onSeeAll = vi.fn()
  render(
    <div>
      <NotificationBell unread={1} latest={rows} onOpen={onOpen} onMarkAll={onMarkAll} onSeeAll={onSeeAll} {...over} />
      <button type="button">outside</button>
    </div>,
  )
  return { onOpen, onMarkAll, onSeeAll }
}

const toggle = () => screen.getByRole('button', { name: /^Notif/ })
/** The panel is in the page whether or not it is open; closed, it is out of the tree, so it is reached by id. */
const panel = () => document.getElementById(toggle().getAttribute('aria-controls') ?? '')

describe('NotificationBell', () => {
  it('says how many are unread on the button, and caps the badge', () => {
    renderBell()
    expect(toggle()).toHaveAccessibleName(m.notif_bell_unread({ n: 1 }))
    expect(toggle()).toHaveTextContent('1')
    cleanup()
    renderBell({ unread: 120, latest: [] })
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('discloses the latest, marks the unread, and hands a press back', () => {
    const { onOpen } = renderBell()
    expect(panel()).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(toggle())
    expect(panel()).toHaveAttribute('aria-hidden', 'false')
    const first = screen.getByRole('button', { name: new RegExp(sentenceFor(rows[0])) })
    expect(first).toHaveAttribute('aria-current', 'true')
    fireEvent.click(first)
    expect(onOpen).toHaveBeenCalledWith(rows[0])
    expect(panel()).toHaveAttribute('aria-hidden', 'true')
  })

  it('offers "mark all" only while something is unread', () => {
    const { onMarkAll } = renderBell()
    fireEvent.click(toggle())
    fireEvent.click(screen.getByRole('button', { name: m.notif_mark_all() }))
    expect(onMarkAll).toHaveBeenCalled()
    cleanup()
    renderBell({ unread: 0, latest: [] })
    fireEvent.click(toggle())
    expect(screen.queryByRole('button', { name: m.notif_mark_all() })).not.toBeInTheDocument()
    expect(screen.getByText(m.notif_none())).toBeInTheDocument()
  })

  it('closes on Escape and on a press outside', () => {
    renderBell()
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panel()).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(toggle())
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(panel()).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('sentenceFor', () => {
  it('addresses the athlete and the staff differently', () => {
    expect(sentenceFor(rows[0])).toBe(m.notif_entry_comment({ actor: 'Luisa', title: 'Copa Regional' }))
    expect(sentenceFor(rows[1])).toBe(m.notif_entry_created({ athlete: 'Regina', title: 'Juego corto' }))
    const base = { _id: 'x', athleteId: 'a1', createdAt: 0, actorName: 'Admin', athleteName: 'Regina' }
    expect(sentenceFor({ ...base, kind: 'assignment_created', userId: 'a1' })).toBe(m.notif_assignment_created_athlete())
    expect(sentenceFor({ ...base, kind: 'assignment_created', userId: 'c1' })).toBe(m.notif_assignment_created_staff({ athlete: 'Regina' }))
  })
})
