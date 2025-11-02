import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth.js'
import { wsManager } from '@/server/managers/ws-manager.js'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import WebSocket from 'ws'

import globalCss from '../globals.css?url'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools.js'
import { initializeServerServices } from '../server/init/start-ws.server.js'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => {
    try {
      await initializeServerServices()
    } catch (error) {
      console.error('[Root] Failed to initialize server services:', error)
      // Don't throw - allow app to continue
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
  const { auth, guildId } = useAuth()
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:1234')
    const connection = wsManager.register(ws, auth.userId, guildId)
    return () => {
      wsManager.unregister(connection)
      ws.close()
    }
  }, [auth.userId, guildId])
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="dark min-h-screen bg-slate-950">
        <head />
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
