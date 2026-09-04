import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as m from '../../src/paraglide/messages.js'

/**
 * Convex answers `null` for two very different reasons, and the panel used to
 * treat them as one: the webhook has not inserted the user yet, or the browser
 * never authenticated against Convex at all. The second one is a wiring fault
 * and telling that reader "we're preparing your account" is a lie — the
 * account is already there, it is the session that is not arriving.
 */
let authState: { isLoading: boolean; isAuthenticated: boolean }
let queryResult: unknown
let statusResult: unknown
/**
 * `RegistrationPanel` also calls `useActiveCycle`, unconditionally, before
 * any of its early returns — so every test here needs an answer for it, not
 * just the ones that reach the form. `null` reads as "no active cycle",
 * which `useActiveCycle` treats the same as still loading: it returns early
 * without touching `.cycle`.
 */
let cycleResult: unknown

vi.mock('convex/react', () => ({
  useConvexAuth: () => authState,
  useQuery: (fn: unknown) =>
    fn === 'users:myStatus' ? statusResult : fn === 'cycles:active' ? cycleResult : queryResult,
  useMutation: () => vi.fn(),
}))

vi.mock('@clerk/tanstack-react-start', () => ({
  useUser: () => ({ user: { fullName: 'Ana Gómez' } }),
}))

vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: { myStatus: 'users:myStatus' },
    registrations: { mine: 'registrations:mine', saveDraft: 'x', submit: 'y' },
    cycles: { active: 'cycles:active' },
  },
}))

const { default: RegistrationPanel } = await import(
  '../../src/components/MyRegistration/RegistrationPanel'
)

beforeEach(() => {
  authState = { isLoading: false, isAuthenticated: true }
  queryResult = undefined
  statusResult = undefined
  cycleResult = null
})

describe('RegistrationPanel null states', () => {
  it('waits while Convex is still deciding whether the session is valid', () => {
    authState = { isLoading: true, isAuthenticated: false }
    queryResult = null
    statusResult = null
    render(<RegistrationPanel />)
    expect(screen.getByText(m.common_loading())).toBeInTheDocument()
    expect(screen.queryByText(m.session_title())).not.toBeInTheDocument()
  })

  it('says the session never reached the server when Convex rejects it', () => {
    authState = { isLoading: false, isAuthenticated: false }
    queryResult = null
    statusResult = null
    render(<RegistrationPanel />)
    expect(screen.getByText(m.session_title())).toBeInTheDocument()
    // The bug: this is what it used to say, and the account already existed.
    expect(screen.queryByText(m.sync_title())).not.toBeInTheDocument()
  })

  it('still reports a genuinely missing row as the webhook running late', () => {
    authState = { isLoading: false, isAuthenticated: true }
    queryResult = null
    statusResult = null
    render(<RegistrationPanel />)
    expect(screen.getByText(m.sync_title())).toBeInTheDocument()
    expect(screen.queryByText(m.session_title())).not.toBeInTheDocument()
  })
})

describe('staff accounts', () => {
  it('sends an account without the athlete role to the admin panel', () => {
    statusResult = {
      account: { roles: ['admin'], emailVerified: true, ageDeclared: false, isMinor: false },
      guardian: { required: false, confirmed: true },
      registration: null,
    }
    queryResult = { registration: null, editable: true, closesAt: 0 }
    render(<RegistrationPanel />)
    expect(screen.getByTestId('navigate')).toHaveTextContent('/administracion')
  })
})
