import type { Appearance } from '@clerk/types'

/**
 * Clerk in XUNTAS's skin.
 *
 * Clerk's components bring their own design and, without this, the sign-up
 * looks like any SaaS's: blue, rounded, foreign. The variables cover 90%; the
 * `elements` fix what the variables cannot reach.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#111111',
    colorText: '#111111',
    colorTextSecondary: 'rgba(17,17,17,.58)',
    colorBackground: '#FFFFFF',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#111111',
    // The focus ring is yellow, just like in the rest of the app.
    colorRing: '#D2DB3A',
    colorDanger: '#B3261E',
    colorSuccess: '#1F7A45',
    colorWarning: '#B26B00',
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
    formButtonPrimary:
      'bg-yel! text-ink! border! border-ink! font-semibold text-[13.5px] normal-case shadow-none hover:bg-yel-d!',
    socialButtonsBlockButton: 'border-line-2 text-ink hover:bg-ink/5',
    formFieldInput: 'border-line-2 rounded-ctl',
    footerActionLink: 'text-ochre font-medium',
    identityPreviewEditButton: 'text-ochre',
    formResendCodeLink: 'text-ochre',
  },
}
