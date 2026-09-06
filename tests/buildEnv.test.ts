import { describe, expect, it } from 'vitest'
import { buildVariableProblems, requireBuildVariables } from '../scripts/build-env'

const good = {
  VITE_CONVEX_URL: 'https://joyous-goshawk-857.convex.cloud',
  VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
}

describe('buildVariableProblems', () => {
  it('accepts a real pair', () => {
    expect(buildVariableProblems(good)).toEqual([])
  })

  it('names every missing variable', () => {
    expect(buildVariableProblems({})).toEqual([
      'VITE_CONVEX_URL is missing',
      'VITE_CLERK_PUBLISHABLE_KEY is missing',
    ])
  })

  it('treats an empty string as missing', () => {
    expect(buildVariableProblems({ ...good, VITE_CONVEX_URL: '' })).toEqual([
      'VITE_CONVEX_URL is missing',
    ])
  })

  /**
   * The concrete regression: Dokploy built staging with a placeholder that
   * was non-empty, the old guard let it through, and the container answered
   * 500 on every route until someone read its log.
   */
  it('rejects a VITE_CONVEX_URL that is not an https URL', () => {
    expect(buildVariableProblems({ ...good, VITE_CONVEX_URL: 'REEMPLAZAR_CONVEX_URL' })).toEqual([
      'VITE_CONVEX_URL must be an https:// URL, got "REEMPLAZAR_CONVEX_URL"',
    ])
    expect(buildVariableProblems({ ...good, VITE_CONVEX_URL: 'http://x.convex.cloud' })).toEqual([
      'VITE_CONVEX_URL must be an https:// URL, got "http://x.convex.cloud"',
    ])
  })

  it('rejects a Clerk key without the pk_ prefix', () => {
    expect(buildVariableProblems({ ...good, VITE_CLERK_PUBLISHABLE_KEY: 'REEMPLAZAR' })).toEqual([
      'VITE_CLERK_PUBLISHABLE_KEY must start with pk_test_ or pk_live_',
    ])
  })

  it('ignores unrelated variables', () => {
    expect(buildVariableProblems({ ...good, CLERK_SECRET_KEY: 'sk_test_x' })).toEqual([])
  })
})

describe('requireBuildVariables', () => {
  it('is silent when everything is fine', () => {
    expect(() => requireBuildVariables(good)).not.toThrow()
  })

  it('throws one error listing every problem', () => {
    expect(() => requireBuildVariables({ VITE_CONVEX_URL: 'nope' })).toThrow(
      /VITE_CLERK_PUBLISHABLE_KEY is missing[\s\S]*VITE_CONVEX_URL must be an https:\/\/ URL/,
    )
  })

  it('points the reader at Infisical', () => {
    expect(() => requireBuildVariables({})).toThrow(/Infisical/)
  })
})
