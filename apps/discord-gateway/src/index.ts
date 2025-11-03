import type { GatewayEventData } from '@repo/discord-integration/clients'
import { DiscordGatewayClient } from '@repo/discord-integration/clients'

import { GatewayWebSocketServer } from './ws-server.js'

/**
 * Discord Gateway Service
 *
 * Separate Node.js service that:
 * 1. Maintains persistent connection to Discord Gateway
 * 2. Receives Discord events (VOICE_STATE_UPDATE, etc.)
 * 3. Forwards events to TanStack Start backend via WebSocket
 * 4. Handles commands from TanStack Start (future)
 */

// Load configuration from environment
const botToken = process.env.DISCORD_BOT_TOKEN
const primaryGuildId = process.env.VITE_DISCORD_GUILD_ID
const wsPort = parseInt(process.env.GATEWAY_WS_PORT || '8080')
const linkToken = process.env.LINK_TOKEN

// Validate required environment variables
if (!botToken) {
  console.error('[Gateway Service] Missing required env var: DISCORD_BOT_TOKEN')
  process.exit(1)
}

if (!primaryGuildId) {
  console.error(
    '[Gateway Service] Missing required env var: VITE_DISCORD_GUILD_ID',
  )
  process.exit(1)
}

if (!linkToken) {
  console.error('[Gateway Service] Missing required env var: LINK_TOKEN')
  process.exit(1)
}

console.log('[Gateway Service] Starting Discord Gateway service...')
console.log(`[Gateway Service] Primary Guild ID: ${primaryGuildId}`)
console.log(`[Gateway Service] WebSocket Port: ${wsPort}`)

// Initialize Discord Gateway client
const gatewayClient = new DiscordGatewayClient(botToken)

// Initialize WebSocket server for TanStack Start
const wsServer = new GatewayWebSocketServer({
  port: wsPort,
  linkToken,
})

// Forward Discord events to connected clients
gatewayClient.onAnyEvent((event: GatewayEventData) => {
  console.log(`[Gateway Service] Discord event: ${event.type}`)
  wsServer.broadcast(event.type, event.data)
})

// Handle commands from TanStack Start (future)
wsServer.onCommand((command: string, _payload: unknown) => {
  console.log(`[Gateway Service] Received command: ${command}`)
  // TODO: Process commands (e.g., send Discord message)
})

// Start services
async function start() {
  try {
    // Start WebSocket server first
    await wsServer.start()
    console.log('[Gateway Service] WebSocket server started')

    // Connect to Discord Gateway
    await gatewayClient.connect()
    console.log('[Gateway Service] Discord Gateway connected')

    console.log('[Gateway Service] Service started successfully')
  } catch (error) {
    console.error('[Gateway Service] Failed to start:', error)
    process.exit(1)
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('[Gateway Service] Shutting down...')

  try {
    gatewayClient.disconnect()
    await wsServer.stop()
    console.log('[Gateway Service] Shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('[Gateway Service] Shutdown error:', error)
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Start the service
start()
