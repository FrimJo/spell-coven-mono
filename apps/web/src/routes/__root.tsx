import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth.js'
import {
  ensureValidDiscordToken,
  getDiscordClient,
} from '@/lib/discord-client.js'
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
  loader: async () => {
    // Get guild ID from session storage (set when room was created)
    const creatorInviteState = sessionStorage.loadCreatorInviteState()
    const guildId =
      creatorInviteState?.guildId || process.env.VITE_DISCORD_GUILD_ID || ''

    // Try to get auth, but don't fail if not authenticated
    // Component will handle showing auth modal
    const token = await ensureValidDiscordToken()

    let auth = null
    if (token) {
      try {
        const client = getDiscordClient()
        const user = await client.fetchUser(token.accessToken)
        auth = {
          accessToken: token.accessToken,
          userId: user.id,
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
        auth = null
      }
    }

    return {
      guildId,
      auth,
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
  const { auth, guildId } = Route.useLoaderData()

  useEffect(() => {
    if (!auth || !guildId) return
    const ws = new WebSocket('ws://localhost:1234')
    const connection = wsManager.register(ws, auth.userId, guildId)
    return () => {
      wsManager.unregister(connection)
      ws.close()
    }
  }, [auth, guildId])

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
