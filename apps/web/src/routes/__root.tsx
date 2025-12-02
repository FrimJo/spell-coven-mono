import type { QueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'

// import globalCss from '@repo/ui/styles/globals.css?url'
import globalCss from '@repo/ui/styles/globals.css?url'

import { AuthProvider } from '../contexts/AuthContext.js'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools.js'

export interface MyRouterContext {
  queryClient: QueryClient
}

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
        title: 'Spell Coven',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: globalCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: () => <div>Not Found</div>,
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

  useEffect(() => {
    // @ts-expect-error: Enable toogle devtools in production
    window.toggleDevtools = () => setShowDevtools((old) => !old)
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="dark min-h-screen bg-slate-950">
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
        <Scripts />
        {import.meta.env.MODE === 'production' && <SpeedInsightsProduction />}
      </body>
    </html>
  )
}
