import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

let inviteResult: unknown

vi.mock('convex/react', () => ({ useQuery: () => inviteResult }))
vi.mock('@clerk/tanstack-react-start', () => ({
  SignUp: (props: { initialValues?: { emailAddress?: string } }) => (
    <div data-testid="signup">{props.initialValues?.emailAddress}</div>
  ),
}))
vi.mock('@tanstack/react-router', () => ({ useParams: () => ({ token: 't1' }) }))
vi.mock('../../convex/_generated/api', () => ({ api: { staff: { getInvite: 'staff:getInvite' } } }))
vi.mock('../../src/components/ThemeProvider', () => ({ useThemeContext: () => ({ resolved: 'light' }) }))

const { default: InviteScreen } = await import('../../src/components/InviteScreen')

beforeEach(() => {
  inviteResult = undefined
})

describe('InviteScreen', () => {
  it('shows who invited and mounts the sign-up with the email prefilled', () => {
    inviteResult = { status: 'pending', email: 'luis@xuntas.org', roles: ['coach'], invitedByName: 'Gerardo' }
    render(<InviteScreen />)
    expect(screen.getByText(m.invite_title())).toBeInTheDocument()
    expect(screen.getByTestId('signup')).toHaveTextContent('luis@xuntas.org')
  })

  it('says why a dead link is dead, without a sign-up', () => {
    inviteResult = { status: 'expired' }
    render(<InviteScreen />)
    expect(screen.getByText(m.invite_expired_title())).toBeInTheDocument()
    expect(screen.queryByTestId('signup')).not.toBeInTheDocument()
  })
})
