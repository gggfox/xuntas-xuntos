import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, type Mock } from 'vitest'
import * as m from '../../src/paraglide/messages.js'
import InviteDialog from '../../src/components/Admin/InviteDialog'
import type { Role } from '../../src/lib/permissions'

type Invite = (input: { email: string; roles: Role[] }) => Promise<{ kind: 'invited' | 'granted' }>

function setup(onInvite: Mock<Invite> = vi.fn<Invite>(async () => ({ kind: 'invited' }))) {
  const onDone = vi.fn()
  const onClose = vi.fn()
  render(<InviteDialog onInvite={onInvite} onDone={onDone} onClose={onClose} />)
  return { onInvite, onDone, onClose }
}

function fill(email: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(m.staff_invite_email())), { target: { value: email } })
}

describe('InviteDialog', () => {
  /**
   * The form used to stand open above the tables. It is a dialog now
   * because a season invites two or three people and then never touches it
   * again — so it opens itself on mount and there is nothing to click first.
   */
  it('opens itself', () => {
    setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAccessibleName(m.staff_invite_title())
  })

  it('sends the address folded and the roles chosen', async () => {
    const { onInvite } = setup()
    fill('  Luis@Xuntas.ORG ')
    fireEvent.click(screen.getByRole('button', { name: m.role_coach() }))
    fireEvent.click(screen.getByRole('button', { name: m.staff_invite_send() }))
    await waitFor(() => expect(onInvite).toHaveBeenCalledWith({ email: 'luis@xuntas.org', roles: ['coach'] }))
  })

  /**
   * The confirmation is handed up rather than shown in here: the dialog
   * closes on success, so a note printed inside it would leave with it.
   */
  it('hands the confirmation up and closes on success', async () => {
    const { onDone, onClose } = setup()
    fill('luis@xuntas.org')
    fireEvent.click(screen.getByRole('button', { name: m.role_coach() }))
    fireEvent.click(screen.getByRole('button', { name: m.staff_invite_send() }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(m.staff_invited()))
    expect(onClose).toHaveBeenCalled()
  })

  it('says which of the two things happened when the account already existed', async () => {
    const { onDone } = setup(vi.fn<Invite>(async () => ({ kind: 'granted' })))
    fill('luis@xuntas.org')
    fireEvent.click(screen.getByRole('button', { name: m.role_coach() }))
    fireEvent.click(screen.getByRole('button', { name: m.staff_invite_send() }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(m.staff_granted()))
  })

  it('refuses an invitation the rules reject, without calling the server', () => {
    const { onInvite, onClose } = setup()
    fill('not-an-email')
    fireEvent.click(screen.getByRole('button', { name: m.staff_invite_send() }))
    expect(onInvite).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  /**
   * The page behind is inert while this is open, so a failure printed out
   * there is one the reader cannot see. It stays in here, and the dialog
   * stays up so the address is not retyped.
   */
  it('keeps a failure inside itself and stays open', async () => {
    const { onClose } = setup(vi.fn<Invite>(async () => Promise.reject(new Error('boom'))))
    fill('luis@xuntas.org')
    fireEvent.click(screen.getByRole('button', { name: m.role_coach() }))
    fireEvent.click(screen.getByRole('button', { name: m.staff_invite_send() }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes without inviting when dismissed', () => {
    const { onInvite, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: m.staff_cancel() }))
    expect(onClose).toHaveBeenCalled()
    expect(onInvite).not.toHaveBeenCalled()
  })

  it('closes when the backdrop is clicked', () => {
    // The dismissal itself is `useModal`'s and is exercised in full by
    // `RegistrationFilters`; what is asserted here is that this dialog is
    // wired to it. jsdom lays nothing out, so the box has to be given one.
    const { onClose } = setup()
    const dialog = screen.getByRole('dialog')
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      top: 200, left: 100, right: 400, bottom: 500, width: 300, height: 300, x: 100, y: 200, toJSON: () => ({}),
    } as DOMRect)

    fireEvent.mouseDown(dialog, { clientX: 20, clientY: 20 })
    fireEvent.click(dialog, { clientX: 20, clientY: 20 })
    expect(onClose).toHaveBeenCalled()
  })
})
