import type { GatewayConfig } from '@repo/discord-gateway'
import {
  createDiscordGatewayEventHandler,
  DiscordGatewayClient,
} from '@repo/discord-gateway'

import { HubClient } from '../hub-client.server'

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
    const hubSecret = process.env.HUB_SECRET

    if (!botToken) {
      throw new Error('Missing required env var: DISCORD_BOT_TOKEN')
    }

    if (!primaryGuildId) {
      throw new Error('Missing required env var: VITE_DISCORD_GUILD_ID')
    }

    if (!hubSecret) {
      throw new Error('Missing required env var: HUB_SECRET')
    }

    // Hub endpoint is the internal events endpoint
    const hubEndpoint = `${process.env.VITE_BASE_URL || 'http://localhost:1234'}/api/internal/events`

    const config: GatewayConfig = {
      port: 0, // Not used when integrated into TanStack Start
      botToken,
      primaryGuildId,
      hubEndpoint,
      hubSecret,
    }

    console.log('[Gateway Init] Configuration loaded')
    console.log(`[Gateway Init] Primary Guild ID: ${config.primaryGuildId}`)
    console.log(`[Gateway Init] Hub Endpoint: ${config.hubEndpoint}`)

    // Create clients
    gatewayClient = new DiscordGatewayClient(config)
    const hubClient = new HubClient(config.hubEndpoint, config.hubSecret)

    // Create and register event handler
    const eventHandler = createDiscordGatewayEventHandler(
      config,
      hubClient as unknown as {
        postEvent: (event: string, payload: unknown) => Promise<void>
      },
    )
    gatewayClient.onEvent(eventHandler)

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
