import { createFileRoute } from '@tanstack/react-router'
import { createWebSocketHandler } from '@/server/ws-crossws-handler'

// WebSocket route using CrossWS
export const Route = createFileRoute('/api/ws')({
  server: {
    handlers: createWebSocketHandler(),
  },
})
