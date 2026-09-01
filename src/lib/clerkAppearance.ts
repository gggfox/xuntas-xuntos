import type { Appearance } from '@clerk/types'
import type { ResolvedTheme } from './theme'

/**
 * Clerk in XUNTAS's skin.
 *
 * Clerk's components bring their own design and, without this, the sign-up
 * looks like any SaaS's: blue, rounded, foreign. The variables cover 90%; the
 * `elements` fix what the variables cannot reach.
 *
 * A function of the theme rather than a constant, and resolved hexes rather
 * than `var(--color-…)`: Clerk derives whole colour scales from `colorPrimary`,
 * and a `var()` reference defeats that arithmetic — it would get a string it
 * cannot lighten or darken.
 *
 * Prefer `elements` over `variables` wherever both could do the job. The
 * `elements` half is Tailwind classes over our own tokens, so it follows the
 * theme with no work and cannot drift; the `variables` half is duplicated
 * hexes that can.
 */
export function clerkAppearance(theme: ResolvedTheme): Appearance {
  const dark = theme === 'dark'
  return {
    variables: {
      colorPrimary: dark ? '#fafaf8' : '#161615',
      colorText: dark ? '#fafaf8' : '#161615',
      colorTextSecondary: dark ? 'rgba(250,250,248,.60)' : 'rgba(22,22,21,.58)',
      colorBackground: dark ? '#1c1c1b' : '#FFFFFF',
      colorInputBackground: dark ? '#1c1c1b' : '#FFFFFF',
      colorInputText: dark ? '#fafaf8' : '#161615',
      // The focus ring is yellow, just like in the rest of the app. It does
      // not move between themes, and neither does the brand yellow.
      colorRing: '#C2CB22',
      // Re-derived for dark: the light values fail contrast on a dark card.
      colorDanger: dark ? '#f87171' : '#B3261E',
      colorSuccess: dark ? '#4ade80' : '#1F7A45',
      colorWarning: dark ? '#e0a33a' : '#B26B00',
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      fontFamilyButtons: '"IBM Plex Sans", system-ui, sans-serif',
      borderRadius: '8px',
    },
    elements: {
      rootBox: 'w-full',
      card: 'shadow-none border border-line rounded-xt bg-card',
      headerTitle: 'font-disp font-bold tracking-[-.01em]',
      headerSubtitle: 'text-soft font-light',
      // Yellow is the primary button, always with an ink border.
      //
      // They carry `!` because Clerk's internal styles win on specificity and
      // the button comes out black (the primary color). Setting `colorPrimary`
      // to yellow does not solve it: that variable also paints the links, and
      // yellow on white does not contrast — see docs/BRAND.md.
      //
      // `on-yel`, not `ink`: the yellow does not move between themes, so
      // whatever sits on it must not either. With `text-ink!` this button
      // would be bone-on-yellow in dark mode.
      formButtonPrimary:
        'bg-yel! text-on-yel! border! border-on-yel! font-semibold text-[13.5px] normal-case shadow-none hover:bg-yel-d!',
      socialButtonsBlockButton: 'border-line-2 text-ink hover:bg-ink/5',
      formFieldInput: 'border-line-2 rounded-ctl',
      footerActionLink: 'text-ochre font-medium',
      identityPreviewEditButton: 'text-ochre',
      formResendCodeLink: 'text-ochre',
    },
  }
}
