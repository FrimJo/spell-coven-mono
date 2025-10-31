import { createFileRoute } from '@tanstack/react-router'
import { createWebSocketHandler } from '@/server/ws-crossws-handler'

// WebSocket route using CrossWS
export const Route = createFileRoute('/api/ws')({
  server: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handlers: createWebSocketHandler() as any,
  },
})
