import type { QueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useEffectEvent, useState } from 'react'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'

import globalCss from '@repo/ui/styles/globals.css?url'

import type {
  MtgColorTheme,
  ResolvedTheme,
  Theme,
} from '../contexts/ThemeContext.js'
import { ErrorPage } from '../components/ErrorPage.js'
import { NotFoundPage } from '../components/NotFoundPage.js'
import { AuthProvider } from '../contexts/AuthContext.js'
import {
  parseThemeFromCookies,
  ThemeProvider,
} from '../contexts/ThemeContext.js'
import { ConvexProvider } from '../integrations/convex/provider.js'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools.js'

export interface MyRouterContext {
  queryClient: QueryClient
}

const getThemeFromCookies = createServerFn({ method: 'GET' }).handler(
  async () => {
    const cookieHeader = getRequestHeader('Cookie') ?? ''
    return parseThemeFromCookies(cookieHeader)
  },
)

const siteUrl = 'https://spell-coven.vercel.app/'
const siteName = 'Spell Coven'
const siteDescription =
  'Play paper Magic: The Gathering remotely with video chat and card recognition. Use your physical cards, see your opponents, and enjoy the authentic experience. Free, browser-based, no downloads required.'
const ogImageUrl = `${siteUrl}/og-image.png`
// Runs synchronously before React hydrates to apply the correct theme class
// and MTG attribute so there is no flash.  Reads from cookies; falls back to
// localStorage for one-time migration of pre-cookie preferences.
// Cookie names must stay in sync with THEME_COOKIE / MTG_THEME_COOKIE in
// ThemeContext.tsx.
const themeBootstrapScript = `
(() => {
  try {
    var C = document.cookie;
    function cv(n) {
      var m = C.match(new RegExp('(?:^|;\\\\s*)' + n + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    }

    var theme = cv('sc-theme');
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') theme = 'dark';

    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

    var root = document.documentElement;
    if (resolved === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    var mtg = cv('sc-mtg-theme');
    if (mtg === 'white' || mtg === 'blue' || mtg === 'black' || mtg === 'red' || mtg === 'green') {
      root.setAttribute('data-mtg-theme', mtg);
    } else {
      root.removeAttribute('data-mtg-theme');
    }
  } catch(e) {}
})();
`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: async () => {
    const themeSnapshot = await getThemeFromCookies()
    return { themeSnapshot }
  },
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: siteName,
      },
      {
        name: 'description',
        content: siteDescription,
      },
      // Open Graph / Facebook
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: siteUrl,
      },
      {
        property: 'og:title',
        content: siteName,
      },
      {
        property: 'og:description',
        content: siteDescription,
      },
      {
        property: 'og:image',
        content: ogImageUrl,
      },
      {
        property: 'og:image:width',
        content: '1024',
      },
      {
        property: 'og:image:height',
        content: '1024',
      },
      {
        property: 'og:site_name',
        content: siteName,
      },
      // Twitter / X
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:url',
        content: siteUrl,
      },
      {
        name: 'twitter:title',
        content: siteName,
      },
      {
        name: 'twitter:description',
        content: siteDescription,
      },
      {
        name: 'twitter:image',
        content: ogImageUrl,
      },
      // Additional meta tags for better SEO and social sharing
      {
        name: 'theme-color',
        content: '#0f172a',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: siteName,
      },
      {
        name: 'application-name',
        content: siteName,
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: globalCss,
      },
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '192x192',
        href: '/logo192.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'canonical',
        href: siteUrl,
      },
    ],
  }),

  shellComponent: RootDocument,
})

const TanStackDevtoolsProduction = lazy(() =>
  import('@tanstack/react-devtools').then((d) => ({
    default: d.TanStackDevtools,
  })),
)

const TanStackRouterDevtoolsPanelProduction = lazy(() =>
  import('@tanstack/react-router-devtools').then((d) => ({
    default: d.TanStackRouterDevtoolsPanel,
  })),
)

const SpeedInsightsProduction = lazy(() =>
  import('@vercel/speed-insights/react').then((d) => ({
    default: d.SpeedInsights,
  })),
)

function resolveServerTheme(theme: Theme): ResolvedTheme {
  // Server cannot resolve 'system'; default to 'dark'.
  return theme === 'system' ? 'dark' : theme
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { themeSnapshot } = Route.useLoaderData()

  const serverResolved = resolveServerTheme(themeSnapshot.theme)
  const htmlClass = serverResolved === 'dark' ? 'dark' : undefined
  const mtgAttr: MtgColorTheme | undefined =
    themeSnapshot.mtgTheme !== 'none' ? themeSnapshot.mtgTheme : undefined

  const [showDevtools, setShowDevtools] = useState(
    import.meta.env.MODE === 'development',
  )

  const handleShowDevtools = useEffectEvent(() => {
    setShowDevtools(false)
  })

  useEffect(() => {
    if (navigator.webdriver === true) {
      handleShowDevtools()
    }

    // @ts-expect-error: Enable toogle devtools in production
    window.toggleDevtools = () => setShowDevtools((old) => !old)
  }, [])

  return (
    <html
      lang="en"
      className={htmlClass}
      data-mtg-theme={mtgAttr}
      suppressHydrationWarning
    >
      <head>
        <script>{themeBootstrapScript}</script>
        <HeadContent />
      </head>
      <body className="bg-surface-0 min-h-screen">
        <ThemeProvider
          defaultTheme={themeSnapshot.theme}
          defaultMtgTheme={themeSnapshot.mtgTheme}
        >
          <ConvexProvider>
            <AuthProvider>
              {children}
              <Suspense fallback={null}>
                {showDevtools && (
                  <TanStackDevtoolsProduction
                    config={{
                      position: 'bottom-right',
                    }}
                    plugins={[
                      {
                        name: 'Tanstack Router',
                        render: <TanStackRouterDevtoolsPanelProduction />,
                      },
                      TanStackQueryDevtools,
                    ]}
                  />
                )}
              </Suspense>
            </AuthProvider>
          </ConvexProvider>
        </ThemeProvider>
        <Scripts />
        {import.meta.env.MODE === 'production' && <SpeedInsightsProduction />}
      </body>
    </html>
  )
}
