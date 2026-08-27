import type { Appearance } from '@clerk/types'

/**
 * Clerk con la piel de XUNTAS.
 *
 * Los componentes de Clerk traen su propio diseño y, sin esto, el alta se ve
 * como la de cualquier SaaS: azul, redondeado, ajeno. Las variables cubren el
 * 90%; los `elements` corrigen lo que las variables no alcanzan.
 */
export const aparienciaClerk: Appearance = {
  variables: {
    colorPrimary: '#111111',
    colorText: '#111111',
    colorTextSecondary: 'rgba(17,17,17,.58)',
    colorBackground: '#FFFFFF',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#111111',
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
    // El amarillo es el botón principal, siempre con borde de tinta.
    formButtonPrimary:
      'bg-yel text-ink border border-ink font-semibold text-[13.5px] normal-case shadow-none hover:bg-yel-d',
    socialButtonsBlockButton: 'border-line-2 text-ink hover:bg-ink/5',
    formFieldInput: 'border-line-2 rounded-ctl',
    footerActionLink: 'text-ochre font-medium',
    identityPreviewEditButton: 'text-ochre',
    formResendCodeLink: 'text-ochre',
  },
}
