import { createServerOnlyFn } from '@tanstack/react-start'

/**
 * Initialize server-side services
 *
 * This should be called once during server startup.
 * Initializes the Gateway WebSocket client to connect to the Discord Gateway service.
 *
 * Uses createServerOnlyFn to ensure this code is never bundled for the browser,
 * and lazy imports the gateway initialization to prevent leaking server code.
 */
export const initializeServerServices = createServerOnlyFn(async () => {
  try {
    console.log('[Server Init] Starting server services initialization...')

    // Lazy import to prevent bundling server code
    const { initializeGatewayClient } = await import(
      './gateway-client-init.server.js'
    )
    await initializeGatewayClient()

    console.log('[Server Init] Server services initialized successfully')
  } catch (error) {
    console.error('[Server Init] Failed to initialize server services:', error)
    // Don't throw - allow server to start even if gateway fails
    // The gateway will attempt to reconnect
  }
})
