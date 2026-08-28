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
      { title: m.meta_title() },
      { name: 'description', content: m.meta_description() },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-paper text-ink font-body antialiased">
        <ClerkProvider localization={esMX}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <AppBar />
            {children}
            <footer className="mt-20 border-t border-line">
              <div className="mx-auto max-w-[900px] px-[22px] py-6">
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
