import type { QueryClient } from '@tanstack/react-query'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import globalCss from '../globals.css?url'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools.js'
import { initializeServerServices } from '../server/init/start-ws.server.js'
import appCss from '../styles.css?url'

export interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => {
    // Only initialize on server
    if (typeof window !== 'undefined') {
      return
    }

    try {
      await initializeServerServices()
    } catch (error) {
      console.error('[Root] Failed to initialize server services:', error)
      // Don't throw - allow app to continue
    }
  },
  loader: async () => {
    // Get guild ID from environment
    const guildId = process.env.VITE_DISCORD_GUILD_ID || ''

    // Auth is fetched on the client side where localStorage is available
    // Server-side loader cannot access client-only functions
    return {
      guildId,
      auth: null,
    }
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
        href: appCss,
      },
      {
        rel: 'stylesheet',
        href: globalCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: () => <div>Not Found</div>,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="dark min-h-screen bg-slate-950">
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
