import type { QueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useEffectEvent, useState } from 'react'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'

// import globalCss from '@repo/ui/styles/globals.css?url'
import globalCss from '@repo/ui/styles/globals.css?url'

import { AuthProvider } from '../contexts/AuthContext.js'
import { ThemeProvider } from '../contexts/ThemeContext.js'
import { ConvexProvider } from '../integrations/convex/provider.js'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools.js'

export interface MyRouterContext {
  queryClient: QueryClient
}

const siteUrl = 'https://spell-coven.vercel.app/'
const siteName = 'Spell Coven'
const siteDescription =
  'Play paper Magic: The Gathering remotely with video chat and card recognition. Use your physical cards, see your opponents, and enjoy the authentic experience. Free, browser-based, no downloads required.'
const ogImageUrl = `${siteUrl}/og-image.png`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: async () => {
    // Client-side loader - return minimal data
    return {}
  },
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

function RootDocument({ children }: { children: React.ReactNode }) {
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
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  try {
    const themeKey = 'spell-coven-theme';
    const mtgThemeKey = 'spell-coven-mtg-theme';
    const storedTheme = localStorage.getItem(themeKey);
    const storedMtgTheme = localStorage.getItem(mtgThemeKey);

    const theme =
      storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system'
        ? storedTheme
        : 'dark';

    const resolvedTheme =
      theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;

    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (
      storedMtgTheme === 'none' ||
      storedMtgTheme === 'white' ||
      storedMtgTheme === 'blue' ||
      storedMtgTheme === 'black' ||
      storedMtgTheme === 'red' ||
      storedMtgTheme === 'green'
    ) {
      if (storedMtgTheme === 'none') {
        root.removeAttribute('data-mtg-theme');
      } else {
        root.setAttribute('data-mtg-theme', storedMtgTheme);
      }
    }
  } catch {
    // no-op: use default styles
  }
})();
`,
          }}
        />
        <HeadContent />
      </head>
      <body className="bg-surface-0 min-h-screen">
        <ThemeProvider defaultTheme="dark">
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
