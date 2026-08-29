import { describe, expect, it } from 'vitest'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import { toErrorMap, validateRegistration } from '../convex/lib/registrationRules'
import type { RegistrationData } from '../convex/lib/registrationSchema'

describe('server validation contract', () => {
  it('rejects a branch the client would also reject', () => {
    const d: RegistrationData = emptyRegistration()
    d.personal.branch = '' as RegistrationData['personal']['branch']
    // Before this change the server accepted any branch: the check existed
    // only on the client, which is not a check.
    expect(toErrorMap(validateRegistration(d))['personal.branch']).toBe('branch_required')
  })

  it('never returns prose', () => {
    for (const e of validateRegistration(emptyRegistration())) {
      expect(e.code).toMatch(/^[a-z0-9_]+$/)
      expect(e.code).not.toContain(' ')
    }
  })
})
