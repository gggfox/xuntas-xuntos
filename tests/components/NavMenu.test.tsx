import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import NavMenu from '../../src/components/AppBar/NavMenu'

/**
 * The menu is given its links rather than knowing them: the header's own
 * links come from Clerk and Convex, and none of that has to be stood up to
 * ask whether a disclosure discloses. What is asserted here is only what the
 * bar promises — that the links are reachable, that the button says whether
 * they are on screen, and that every ordinary way of dismissing a menu
 * dismisses this one.
 */
function renderMenu() {
  return render(
    <div>
      <NavMenu>
        {/* Hash hrefs: jsdom implements no navigation and logs an error for
            a real one, where the router's own `Link` never navigates the
            document at all. Nothing here turns on the destination. */}
        <a href="#mi-registro">{m.nav_my_registration()}</a>
        <a href="#entrar">{m.nav_sign_in()}</a>
      </NavMenu>
      <button type="button">outside</button>
    </div>,
  )
}

const toggle = () => screen.getByRole('button', { name: m.nav_menu() })
const link = () => screen.queryByRole('link', { name: m.nav_my_registration() })

describe('NavMenu', () => {
  it('keeps the links off the screen until it is opened', () => {
    renderMenu()
    expect(link()).toBeNull()
    fireEvent.click(toggle())
    expect(link()).toBeVisible()
  })

  it('says whether it is open', () => {
    renderMenu()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('names the panel it controls', () => {
    renderMenu()
    fireEvent.click(toggle())
    // The button's `aria-controls` has to point at the panel that actually
    // holds the links, not merely at some element that exists.
    const panel = document.getElementById(toggle().getAttribute('aria-controls') ?? '')
    expect(panel).toContainElement(link())
  })

  it('closes on Escape, and hands focus back to the button', () => {
    renderMenu()
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(link()).toBeNull()
    // Focus would otherwise be left on nothing: the element it was on is
    // the one that just left the page.
    expect(toggle()).toHaveFocus()
  })

  it('closes when a click lands outside it', () => {
    renderMenu()
    fireEvent.click(toggle())
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }))
    expect(link()).toBeNull()
  })

  it('closes when a link inside it is followed', () => {
    // How it closes on navigation. The router swaps the page under the
    // header without unmounting it, so nothing else would put the panel
    // away, and the reader would arrive at the new page still behind it.
    renderMenu()
    fireEvent.click(toggle())
    fireEvent.click(link()!)
    expect(link()).toBeNull()
  })

  it('leaves focus alone when it closes without Escape', () => {
    // Pulling focus back on an outside click would steal it from whatever
    // the reader just reached for.
    renderMenu()
    fireEvent.click(toggle())
    const outside = screen.getByRole('button', { name: 'outside' })
    fireEvent.mouseDown(outside)
    expect(toggle()).not.toHaveFocus()
  })

  it('leaves the closed panel in the page, out of the accessibility tree', () => {
    // It stays mounted so the stylesheet has something to transition *out*;
    // unmounting on close would make the panel vanish mid-animation. What
    // makes it closed is therefore not its absence but `aria-hidden` and
    // `inert` — nothing can read it, tab into it, or click it.
    renderMenu()
    const panel = document.getElementById(toggle().getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeNull()
    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel).toHaveAttribute('inert')
    expect(link()).toBeNull()
  })
})
