/**
 * Documents that the call for applications references and that must exist
 * before registration opens.
 *
 * `ready: false` is a deliberate flag, not a forgotten to-do. While it is
 * false:
 *
 * - the document's page is shown with a notice that it is a draft, and
 * - the form says so next to the checkbox that references it.
 *
 * The privacy notice is **blocking** for launch: the `ck3` checkbox cannot
 * link to a page that does not exist, and under the LFPDPPP the registration
 * of a minor should not be accepted without a published notice. See
 * `docs/DECISIONS.md`.
 *
 * When XUNTAS delivers the text: paste it into the route component and set
 * `ready: true`. Nothing more.
 */
export const DOCUMENTS = {
  privacyNotice: {
    path: '/aviso-de-privacidad',
    ready: false,
  },
  rules: {
    path: '/bases',
    ready: false,
  },
} as const

/** Is any document the call for applications takes for granted still unpublished? */
export const HAS_PENDING_DOCUMENTS = Object.values(DOCUMENTS).some((d) => !d.ready)
