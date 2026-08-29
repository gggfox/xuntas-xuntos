import { describe, expect, it } from 'vitest'
import { strategy, urlPatterns } from '../src/paraglide/runtime.js'
import { paraglideOptions } from '../paraglide.config.mjs'

/**
 * The generated `src/paraglide` has to be the one the app is configured for.
 *
 * It is written twice: by the Vite plugin on `dev`/`build`, and by
 * `npm run paraglide` before typecheck and tests. When those two disagree,
 * nothing fails loudly — the app just resolves locales by other rules than
 * the ones in the config. That is how the sign-in went blank once: the
 * offline compile dropped the `/es/` prefix, so `<SignIn path="/es/entrar">`
 * no longer matched the `/entrar` the browser was on, and Clerk rendered an
 * empty box with no error anywhere.
 */
describe('the compiled paraglide runtime', () => {
  it('uses the configured strategy', () => {
    expect(strategy).toEqual(paraglideOptions.strategy)
  })

  it('uses the configured URL patterns, prefix for every locale included', () => {
    expect(urlPatterns).toEqual(paraglideOptions.urlPatterns)
  })
})
