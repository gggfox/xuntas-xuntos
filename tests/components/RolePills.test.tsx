import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import RolePills from '../../src/components/Admin/RolePills'
import type { Role } from '../../src/lib/permissions'

const three: readonly Role[] = ['admin', 'coach', 'finance']

describe('RolePills', () => {
  it('prints a single role with no control beside it', () => {
    render(<RolePills roles={['coach']} />)
    expect(screen.getByText(m.role_coach())).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  /**
   * The whole point: one line per row whatever the person's roles are. If
   * every role were printed, a three-role row would wrap and the table's
   * rows would stop being the same height.
   */
  it('prints only the first of several, and counts the rest', () => {
    render(<RolePills roles={three} />)
    expect(screen.getByText(m.role_admin())).toBeInTheDocument()
    expect(screen.queryByText(m.role_coach())).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.staff_roles_more({ n: 2 }) })).toHaveTextContent('+2')
  })

  it('starts closed and says so', () => {
    render(<RolePills roles={three} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  /**
   * Press, not hover, is the one that has to work: this screen gets opened
   * from a tablet where there is no hover at all.
   */
  it('opens the rest on a press and closes again on a second one', () => {
    render(<RolePills roles={three} />)
    const more = screen.getByRole('button')
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(m.role_coach())).toBeInTheDocument()
    expect(screen.getByText(m.role_finance())).toBeInTheDocument()
    fireEvent.click(more)
    expect(screen.queryByText(m.role_coach())).not.toBeInTheDocument()
  })

  it('opens on hover for a mouse and closes when it leaves', () => {
    render(<RolePills roles={three} />)
    const more = screen.getByRole('button')
    fireEvent.pointerEnter(more, { pointerType: 'mouse' })
    expect(screen.getByText(m.role_coach())).toBeInTheDocument()
    fireEvent.pointerLeave(more, { pointerType: 'mouse' })
    expect(screen.queryByText(m.role_coach())).not.toBeInTheDocument()
  })

  /**
   * A tap fires `pointerenter` before the click. Acting on both would open
   * the panel on the way in and let the click shut it again — a tap that
   * visibly does nothing at all.
   */
  it('ignores the pointerenter a tap fires, so the tap itself opens it', () => {
    render(<RolePills roles={three} />)
    const more = screen.getByRole('button')
    fireEvent.pointerEnter(more, { pointerType: 'touch' })
    expect(screen.queryByText(m.role_coach())).not.toBeInTheDocument()
    fireEvent.click(more)
    expect(screen.getByText(m.role_coach())).toBeInTheDocument()
  })

  it('closes on Escape and on a press elsewhere', () => {
    render(<RolePills roles={three} />)
    const more = screen.getByRole('button')

    fireEvent.click(more)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(more).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(more)
    fireEvent.pointerDown(document.body)
    expect(more).toHaveAttribute('aria-expanded', 'false')
  })

  it('names the panel it controls', () => {
    render(<RolePills roles={three} />)
    const more = screen.getByRole('button')
    fireEvent.click(more)
    const panel = screen.getByRole('group', { name: m.staff_col_roles() })
    expect(more).toHaveAttribute('aria-controls', panel.id)
  })
})
