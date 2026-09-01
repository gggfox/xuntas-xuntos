import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { esMX } from '@clerk/localizations'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { convex } from '../lib/convex'
import { getLocale } from '../paraglide/runtime.js'
import * as m from '../paraglide/messages.js'
import AppBar from '../components/AppBar'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // The brand is light paper. Declared so the browser doesn't invent a
      // dark mode over forms that don't have one.
      { name: 'color-scheme', content: 'light only' },
      // Translated like everything else. `head` runs per request, so it sees
      // the locale Paraglide resolved for that request — which matters now
      // that the browser's language can pick it.
      //
      // This is the home page's title and the fallback for anything that does
      // not set one: each route overrides it from its own `head`, and the
      // deepest title wins.
      { title: m.meta_title() },
      { name: 'description', content: m.meta_description() },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      /*
       * SVG first: it is one file for every size and stays sharp. The mark
       * rides on an ink tile because yellow on a light tab strip does not
       * contrast — the same rule BRAND.md states for yellow on paper.
       */
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col bg-paper text-ink font-body antialiased">
        <ClerkProvider localization={esMX}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <AppBar />
            {children}
            {/*
              mt-auto, not a fixed margin: on a page shorter than the window the
              footer lands on the bottom edge instead of floating with a band of
              paper underneath it. On a long page the margin collapses to nothing
              and the page's own bottom padding does the spacing.
            */}
            <footer className="relative mt-auto border-t border-line">
              <div className="band py-[15px]">
                <p className="eyebrow">
                  {m.brand_cycle()} · {m.reg_closing()}
                </p>
              </div>
            </footer>
            <Scripts />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </body>
    </html>
  )
}
