import { createGatewaySseResponse } from '@/server/gateway/sse-router.server'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/stream')({
  server: {
    handlers: {
      GET: ({ request }) => createGatewaySseResponse(request),
    },
  },
})
