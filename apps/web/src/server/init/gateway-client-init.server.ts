import { createServerOnlyFn } from '@tanstack/react-start'

/**
 * Gateway Client Initialization
 *
 * Initializes WebSocket connection to the Discord Gateway service.
 * Events from Gateway are forwarded to the event bus for SSE distribution.
 */

let isInitialized = false

export const initializeGatewayClient = createServerOnlyFn(async () => {
  if (isInitialized) {
    console.log('[Gateway Client Init] Already initialized')
    return
  }

  try {
    console.log(
      '[Gateway Client Init] Starting Gateway client initialization...',
    )

    // Lazy import to prevent bundling
    const { GatewayWebSocketClient } = await import('../gateway-client.js')
    const { getServices } = await import('../config/services.js')

    // Load configuration
    const gatewayUrl = process.env.GATEWAY_WS_URL || 'ws://localhost:8080'
    const linkToken = process.env.LINK_TOKEN

    if (!linkToken) {
      throw new Error('Missing required env var: LINK_TOKEN')
    }

    console.log(`[Gateway Client Init] Gateway URL: ${gatewayUrl}`)

    // Create Gateway client
    const gatewayClient = new GatewayWebSocketClient({
      gatewayUrl,
      linkToken,
    })

    // Get event bus
    const services = getServices()

    // Forward Gateway events to event bus
    gatewayClient.onEvent((event: string, payload: unknown) => {
      console.log(`[Gateway Client] Event received: ${event}`)
      services.eventBus.emit({ event, payload })
    })

    // Connect to Gateway service
    await gatewayClient.connect()

    isInitialized = true
    console.log('[Gateway Client Init] Gateway client initialized successfully')
  } catch (error) {
    console.error(
      '[Gateway Client Init] Failed to initialize Gateway client:',
      error,
    )
    throw error
  }
})
