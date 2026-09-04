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
 * `RegistrationPanel` also calls `useActiveCycle`, and its own loading gate
 * now waits on it — nothing below that gate may render a sentence that needs
 * a date it does not have yet. A resolved cycle is the default so every test
 * here reaches the screen it is actually testing, `authLoading`/`isAuthenticated`
 * included: those are what each test below actually varies.
 */
let cycleResult: unknown
const RESOLVED_CYCLE = {
  cycle: '2026-2027',
  opensOn: '2026-09-04',
  closesOn: '2026-09-18',
  reviewOn: '2026-09-23',
  opensAtMs: 0,
  closesAtMs: 0,
  isOpen: true,
  beforeOpening: false,
}

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
  cycleResult = RESOLVED_CYCLE
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
