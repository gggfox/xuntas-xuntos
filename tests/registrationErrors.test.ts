import { describe, expect, it } from 'vitest'
import { errorCodeFromConvex, errorMessage } from '../src/lib/registrationErrors'
import type { AppErrorCode } from '../convex/lib/errorCodes'
import { validateRegistration } from '../convex/lib/registrationRules'
import { validateBirthDateDeclaration } from '../convex/lib/guardianRules'
import { emptyRegistration } from '../convex/lib/registrationSchema'
import en from '../messages/en.json'
import es from '../messages/es.json'

/**
 * Every code a rule can actually produce must render a real sentence.
 *
 * `Record<AppErrorCode, ...>` already makes the compiler demand an entry per
 * code, but it cannot tell that the Paraglide key behind an entry exists and
 * is non-empty. A key deleted from one locale compiles to a function that
 * returns the key name, and the reader gets `reg_ck_rules_error` in a red box.
 */

/** Codes reachable by driving the rules with the worst input there is. */
function reachableCodes(): AppErrorCode[] {
  const now = Date.parse('2026-08-27T12:00:00.000Z')
  const codes = new Set<AppErrorCode>()

  for (const e of validateRegistration(emptyRegistration(), now)) codes.add(e.code)
  for (const d of [
    { birthDate: '' },
    { birthDate: '2030-01-01' },
    { birthDate: '1899-01-01' },
    { birthDate: '2012-04-11' },
    { birthDate: '2012-04-11', guardianName: 'R'.repeat(500), guardianEmail: 'a@b.co' },
    { birthDate: '2012-04-11', guardianName: 'R', guardianEmail: 'a@b.co', ownEmail: 'a@b.co' },
  ]) {
    for (const e of validateBirthDateDeclaration(d, now)) codes.add(e.code)
  }

  return [...codes]
}

describe('errorMessage', () => {
  it('renders every reachable code', () => {
    const codes = reachableCodes()
    expect(codes.length).toBeGreaterThan(10)

    for (const code of codes) {
      const text = errorMessage(code)
      expect(text, code).toBeTruthy()
      // A missing key compiles to a function returning the key itself.
      expect(text, code).not.toBe(code)
    }
  })

  it('fills the limit into the letter message rather than leaving a placeholder', () => {
    expect(errorMessage('letter_too_long')).toContain('3000')
    expect(errorMessage('letter_too_long')).not.toContain('{limit}')
  })
})

/**
 * `errorMessage` can only ever be checked against one locale here: Paraglide
 * resolves the locale from the URL, and `setLocale` is a no-op outside a
 * browser. So the other locales are checked at the source instead — which
 * also covers every key in the app, not just the error ones.
 */
describe('the locale files', () => {
  const locales = { es, en }

  it('define the same keys in the same order', () => {
    expect(Object.keys(en)).toEqual(Object.keys(es))
  })

  for (const [name, messages] of Object.entries(locales)) {
    it(`has no empty translation in ${name}`, () => {
      const empty = Object.entries(messages)
        .filter(([key]) => key !== '$schema')
        .filter(([, value]) => typeof value !== 'string' || !value.trim())
        .map(([key]) => key)
      expect(empty).toEqual([])
    })
  }

  it('leaves no placeholder unfilled across locales', () => {
    for (const [name, messages] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(messages)) {
        if (key === '$schema' || typeof value !== 'string') continue
        const placeholders = [...value.matchAll(/\{(\w+)\}/g)].map((mm) => mm[1]).sort()
        const other = name === 'es' ? en : es
        const twin = (other as Record<string, string>)[key]
        if (typeof twin !== 'string') continue
        const twinPlaceholders = [...twin.matchAll(/\{(\w+)\}/g)].map((mm) => mm[1]).sort()
        expect(placeholders, key).toEqual(twinPlaceholders)
      }
    }
  })
})

describe('errorCodeFromConvex', () => {
  it('ignores an error that is not a ConvexError', () => {
    expect(errorCodeFromConvex(new Error('boom'))).toBeUndefined()
  })

  it('ignores a code it does not know', () => {
    expect(errorCodeFromConvex({ data: { code: 'not_a_real_code' } })).toBeUndefined()
  })
})
