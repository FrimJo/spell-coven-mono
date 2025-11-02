import { ensureGatewayStarted } from '../gateway/gateway-ws.client'

/**
 * Initialize server-side services
 *
 * This should be called once during server startup.
 * Currently initializes the Discord Gateway client.
 */
export async function initializeServerServices(): Promise<void> {
  try {
    console.log('[Server Init] Starting server services initialization...')
    await ensureGatewayStarted()
    console.log('[Server Init] Server services initialized successfully')
  } catch (error) {
    console.error('[Server Init] Failed to initialize server services:', error)
    // Don't throw - allow server to start even if gateway fails
    // The gateway will attempt to reconnect
  }
}
