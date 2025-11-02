import { createServerOnlyFn } from '@tanstack/react-start'

/**
 * Initialize server-side services
 *
 * This should be called once during server startup.
 * Currently initializes the Discord Gateway client.
 *
 * Uses createServerOnlyFn to ensure this code is never bundled for the browser,
 * and lazy imports the gateway initialization to prevent leaking server code.
 */
export const initializeServerServices = createServerOnlyFn(async () => {
  try {
    console.log('[Server Init] Starting server services initialization...')

    // Lazy import to prevent bundling server code
    const { initializeDiscordGateway } = await import('./discord-gateway-init.server.js')
    await initializeDiscordGateway()

    console.log('[Server Init] Server services initialized successfully')
  } catch (error) {
    console.error('[Server Init] Failed to initialize server services:', error)
    // Don't throw - allow server to start even if gateway fails
    // The gateway will attempt to reconnect
  }
})
