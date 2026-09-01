import { describe, expect, it } from 'vitest'
import { emptyRegistration, prepareForSubmit } from '../convex/lib/registrationSchema'
import { RESULTS_MIN } from '../convex/lib/registrationRules'

/**
 * The blank rows are the ask. `emptyRegistration` writes the count out by
 * hand — importing `RESULTS_MIN` there would be a cycle — so this is what
 * stops the two from drifting apart.
 */
describe('emptyRegistration', () => {
  it('seeds one blank result row per required result', () => {
    expect(emptyRegistration().results).toHaveLength(RESULTS_MIN)
  })
})

describe('prepareForSubmit', () => {
  it('normalizes the email', () => {
    const d = emptyRegistration({ email: '  Ana@Example.COM ' })
    expect(prepareForSubmit(d).personal.email).toBe('ana@example.com')
  })

  it('drops half-filled rows', () => {
    const d = emptyRegistration()
    d.results = [
      { tournament: 'CNIJ', result: '2º' },
      { tournament: 'Solo torneo', result: '' },
      { tournament: '', result: '' },
    ]
    expect(prepareForSubmit(d).results).toEqual([{ tournament: 'CNIJ', result: '2º' }])
  })

  it('drops rankings without a position', () => {
    // `emptyRegistration` seeds the four fixed rankings with an empty position.
    expect(prepareForSubmit(emptyRegistration()).rankings).toEqual([])
  })

  it('does not touch the original data', () => {
    const d = emptyRegistration({ email: 'ANA@EXAMPLE.COM' })
    prepareForSubmit(d)
    expect(d.personal.email).toBe('ANA@EXAMPLE.COM')
  })
})
