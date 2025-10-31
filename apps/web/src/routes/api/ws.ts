import { createWebSocketHandler } from '@/server/handlers/ws-crossws-handler'
import { createFileRoute } from '@tanstack/react-router'

// WebSocket route using CrossWS
export const Route = createFileRoute('/api/ws')({
  server: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handlers: createWebSocketHandler() as any,
  },
})
