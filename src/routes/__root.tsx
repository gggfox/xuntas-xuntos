import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { esMX } from '@clerk/localizations'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { convex } from '../lib/convex'
import { getLocale } from '../paraglide/runtime.js'
import * as m from '../paraglide/messages.js'
import AppBar from '../components/AppBar'
import ThemeProvider from '../components/ThemeProvider'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      /*
       * `light dark`, not `light only`. Left as `light only` this does not
       * merely go stale, it countermands the CSS: a browser told `light only`
       * at the document level can refuse the `color-scheme: dark` that the
       * `[data-theme="dark"]` block asks for, and native controls, scrollbars
       * and date pickers would stay light inside a dark page.
       */
      { name: 'color-scheme', content: 'light dark' },
      /*
       * Colours the browser and OS chrome — Safari's address bar on iOS, the
       * status bar on Android Chrome. Without it that chrome is painted from
       * the page background and swings from bone to near-black between
       * themes, clashing with the ink band directly beneath it.
       *
       * One static value, and no `media` variants, because the header is
       * #161615 in BOTH themes. That is a dividend of keeping the header
       * fixed: the alternative design needed two of these discriminated by a
       * `media` attribute, and `head().meta` is typed `unknown` in
       * @tanstack/router-core, so passing a non-standard attribute through it
       * would have been guesswork.
       */
      { name: 'theme-color', content: '#161615' },
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

/**
 * Resolves the theme before the browser paints anything.
 *
 * It is inlined into <head> as a string rather than routed through
 * `head().scripts` for two reasons: `headScripts` is typed `unknown` in
 * @tanstack/router-core, and running before first paint is the entire point —
 * a themed page that paints bone first and corrects on hydration is worse
 * than no dark mode at all.
 *
 * The key and the three valid values are duplicated from `src/lib/theme.ts`
 * because a string cannot import. `tests/theme.test.ts` pins the constant, so
 * changing it there fails the suite — which is the tripwire that sends whoever
 * changed it back to this string. Nothing checks this copy automatically.
 *
 * Wrapped in try/catch: Safari throws on `localStorage` under some privacy
 * settings, and a theme is not worth a blank page.
 */
const THEME_SCRIPT = `(function(){try{
var p=localStorage.getItem('xx-theme');
if(p!=='light'&&p!=='dark'&&p!=='system')p='system';
var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.dataset.theme=d?'dark':'light';
}catch(e){document.documentElement.dataset.theme='light'}})()`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-paper text-ink font-body antialiased">
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  )
}
