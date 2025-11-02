import { DiscordGatewayClient } from '@repo/discord-gateway'

import { wsManager } from '../managers/ws-manager'

/**
 * Discord Gateway Initialization
 *
 * Initializes the Discord Gateway client to listen for events and post them to the hub.
 * This runs once when the server starts.
 */

let gatewayClient: DiscordGatewayClient | null = null
let isInitialized = false

/**
 * Initialize the Discord Gateway
 *
 * This should be called once during server startup.
 */
export async function initializeDiscordGateway(): Promise<void> {
  if (isInitialized) {
    console.log('[Gateway Init] Already initialized')
    return
  }

  try {
    console.log('[Gateway Init] Starting Discord Gateway initialization...')

    // Load configuration from environment
    const botToken = process.env.DISCORD_BOT_TOKEN
    const primaryGuildId = process.env.VITE_DISCORD_GUILD_ID

    if (!botToken) {
      throw new Error('Missing required env var: DISCORD_BOT_TOKEN')
    }

    if (!primaryGuildId) {
      throw new Error('Missing required env var: VITE_DISCORD_GUILD_ID')
    }

    console.log('[Gateway Init] Configuration loaded')
    console.log(`[Gateway Init] Primary Guild ID: ${primaryGuildId}`)

    // Create clients
    gatewayClient = new DiscordGatewayClient({ botToken })
    gatewayClient.onEvent((event: string, data: unknown) =>
      wsManager.broadcastToGuild(primaryGuildId, event, data),
    )

    // Connect to Discord Gateway
    await gatewayClient.connect()

    isInitialized = true
    console.log('[Gateway Init] Discord Gateway initialized successfully')
  } catch (error) {
    console.error('[Gateway Init] Failed to initialize Discord Gateway:', error)
    throw error
  }
}

/**
 * Disconnect the Discord Gateway
 *
 * This should be called during server shutdown.
 */
export function disconnectDiscordGateway(): void {
  if (gatewayClient) {
    console.log('[Gateway Init] Disconnecting Discord Gateway...')
    gatewayClient.disconnect()
    gatewayClient = null
    isInitialized = false
  }
}

/**
 * Get the current gateway client state
 */
export function getGatewayState(): string {
  if (!gatewayClient) {
    return 'NOT_INITIALIZED'
  }
  return gatewayClient.getState()
}
