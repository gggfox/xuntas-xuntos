import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import AccountMenu, { initials } from '../../src/components/AppBar/AccountMenu'

/**
 * The menu is handed the account and its links rather than reading them: the
 * real ones come from Clerk, and none of that has to be stood up to ask
 * whether a face opens a panel. What is asserted is what the bar promises —
 * that the button says whose account it is, that the links are reachable
 * once it is pressed, and that every ordinary way of dismissing a menu
 * dismisses this one.
 */
function renderMenu(props: Partial<React.ComponentProps<typeof AccountMenu>> = {}) {
  return render(
    <div>
      <AccountMenu name="Gerardo Galan" email="gerardo@example.com" {...props}>
        <a href="#mi-registro">{m.nav_my_registration()}</a>
        <button type="button">{m.nav_sign_out()}</button>
      </AccountMenu>
      <button type="button">outside</button>
    </div>,
  )
}

const toggle = () => screen.getByRole('button', { name: new RegExp(`^${m.nav_account_menu()}`) })
const link = () => screen.queryByRole('link', { name: m.nav_my_registration() })

describe('AccountMenu', () => {
  it('names the account on the button', () => {
    renderMenu()
    expect(toggle()).toHaveAccessibleName(`${m.nav_account_menu()}: Gerardo Galan`)
  })

  it('shows the picture Clerk holds, and initials when there is none', () => {
    const { unmount } = renderMenu({ imageUrl: 'https://img.clerk.com/x' })
    expect(toggle().querySelector('img')).toHaveAttribute('src', 'https://img.clerk.com/x')
    unmount()
    renderMenu({ imageUrl: null })
    expect(toggle()).toHaveTextContent('GG')
  })

  it('keeps the links off the screen until it is opened', () => {
    renderMenu()
    expect(link()).toBeNull()
    fireEvent.click(toggle())
    expect(link()).toBeVisible()
  })

  it('repeats who is signed in, in words, inside the panel', () => {
    renderMenu()
    fireEvent.click(toggle())
    const panel = document.getElementById(toggle().getAttribute('aria-controls') ?? '')
    expect(panel).toHaveTextContent('Gerardo Galan')
    expect(panel).toHaveTextContent('gerardo@example.com')
    expect(panel).toContainElement(link())
  })

  it('says whether it is open', () => {
    renderMenu()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on Escape, and hands focus back to the button', () => {
    renderMenu()
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(link()).toBeNull()
    expect(toggle()).toHaveFocus()
  })

  it('closes when a click lands outside it', () => {
    renderMenu()
    fireEvent.click(toggle())
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }))
    expect(link()).toBeNull()
  })

  it('closes when a link inside it is followed', () => {
    renderMenu()
    fireEvent.click(toggle())
    fireEvent.click(link()!)
    expect(link()).toBeNull()
  })

  it('leaves the closed panel in the page, out of the accessibility tree', () => {
    renderMenu()
    const panel = document.getElementById(toggle().getAttribute('aria-controls') ?? '')
    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel).toHaveAttribute('inert')
  })
})

describe('initials', () => {
  it('takes the first and last word, or the one word, or nothing', () => {
    expect(initials('Gerardo Galan Garza')).toBe('GG')
    expect(initials('Ana')).toBe('A')
    expect(initials('  ')).toBe('')
  })
})
