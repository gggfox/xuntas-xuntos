/**
 * Paraglide's compiler options, in one place.
 *
 * `src/paraglide` is generated twice: by the Vite plugin on `dev` and
 * `build`, and by `npm run paraglide` before typecheck and tests. The CLI
 * cannot take `urlPatterns` on the command line, so while these options lived
 * in vite.config.ts the offline compile produced a DIFFERENT app: no `url`
 * strategy and no `/es/` prefix. Running `npm test` next to a dev server was
 * enough to leave that version on disk, and then the sign-in went blank —
 * `<SignIn path="/es/entrar">` no longer matched the `/entrar` the browser
 * was on, and Clerk renders nothing when they disagree.
 *
 * Both paths import this file, so there is one answer.
 */
/** @type {import('@inlang/paraglide-js').CompilerOptions} */
export const paraglideOptions = {
  project: './project.inlang',
  outdir: './src/paraglide',
  // `url` first: the path prefix wins over the cookie, so a shared link
  // always opens in the language it was shared in. `cookie` next, so a
  // deliberate choice outlives the browser's setting.
  //
  // `preferredLanguage` was held back while `en.json` was empty: with it
  // on, a family with their browser in English would have landed on /en/
  // and found the interface still in Spanish. `en.json` is translated
  // now, so the condition that comment described is met and it is on.
  strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
  // Both locales are prefixed, Spanish included. Paraglide's default leaves
  // the base locale bare, and a bare `/entrar` is what breaks Clerk.
  urlPatterns: [
    {
      pattern: '/:path(.*)?',
      localized: [
        ['es', '/es/:path(.*)?'],
        ['en', '/en/:path(.*)?'],
      ],
    },
  ],
  // What the Vite plugin passes for this bundler. Repeated here so the
  // offline compile emits the same runtime instead of a near-copy.
  isServer: "import.meta.env?.SSR ?? typeof window === 'undefined'",
}
