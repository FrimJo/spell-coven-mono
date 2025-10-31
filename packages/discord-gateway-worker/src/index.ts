import { createServer } from 'node:http'

import type { GatewayConfig } from './types.js'
import { DiscordGatewayClient } from './gateway.js'
import { HubClient } from './hub-client.js'

/**
 * Load configuration from environment variables
 *
 * Environment variables are loaded by Node's --env-file flag (see package.json scripts)
 * Following Vite/Next.js convention:
 * 1. .env                          - Shared defaults
 * 2. .env.local                    - Local overrides (gitignored)
 * 3. .env.[mode]                   - Environment-specific
 * 4. .env.[mode].local             - Environment-specific local (gitignored, highest priority)
 */
function loadConfig(): GatewayConfig {
  const port = Number(process.env.PORT)
  const botToken = process.env.DISCORD_BOT_TOKEN
  const primaryGuildId = process.env.PRIMARY_GUILD_ID || process.env.VITE_DISCORD_GUILD_ID
  const hubEndpoint = process.env.HUB_ENDPOINT
  const hubSecret = process.env.HUB_SECRET

  if (!port) {
    throw new Error('Missing required env var: PORT')
  }

  if (!botToken) {
    throw new Error('Missing required env var: DISCORD_BOT_TOKEN')
  }

  if (!primaryGuildId) {
    throw new Error('Missing required env var: PRIMARY_GUILD_ID or VITE_DISCORD_GUILD_ID')
  }

  if (!hubEndpoint) {
    throw new Error('Missing required env var: HUB_ENDPOINT')
  }

  if (!hubSecret) {
    throw new Error('Missing required env var: HUB_SECRET')
  }

  return {
    port,
    botToken,
    primaryGuildId,
    hubEndpoint,
    hubSecret,
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('[Worker] Starting Discord Gateway Worker...')

  // Load configuration
  const config = loadConfig()
  console.log('[Worker] Configuration loaded')
  console.log(`[Worker] Primary Guild ID: ${config.primaryGuildId}`)
  console.log(`[Worker] Hub Endpoint: ${config.hubEndpoint}`)

  // Create clients
  const gateway = new DiscordGatewayClient(config)
  const hub = new HubClient(config.hubEndpoint, config.hubSecret)

  // Register event handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gateway.onEvent(async (event, data: any) => {
    console.log(`[Worker] Received Discord event: ${event}`)
    console.log(`[Worker] Event data:`, JSON.stringify(data, null, 2))

    // Filter to primary guild only
    if (data.guild_id && data.guild_id !== config.primaryGuildId) {
      console.log(
        `[Worker] Ignoring event from different guild: ${data.guild_id}`,
      )
      return
    }

    // Handle specific events
    switch (event) {
      case 'CHANNEL_CREATE':
        if (data.type === 2) {
          // Voice channel
          await hub.postEvent('room.created', {
            channelId: data.id,
            name: data.name,
            guildId: data.guild_id,
            parentId: data.parent_id,
            userLimit: data.user_limit ?? 0,
          })
        }
        break

      case 'CHANNEL_DELETE':
        if (data.type === 2) {
          // Voice channel
          await hub.postEvent('room.deleted', {
            channelId: data.id,
            guildId: data.guild_id,
          })
        }
        break

      case 'VOICE_STATE_UPDATE':
        // User joined voice channel
        if (data.channel_id && !data.before?.channel_id) {
          // Extract user info from the event
          // Discord includes user object in VOICE_STATE_UPDATE
          const username = data.user?.username || 'Unknown User'
          const avatar = data.user?.avatar || null

          await hub.postEvent('voice.joined', {
            guildId: data.guild_id,
            channelId: data.channel_id,
            userId: data.user_id,
            username,
            avatar,
          })
        }
        // User left voice channel
        else if (!data.channel_id && data.before?.channel_id) {
          await hub.postEvent('voice.left', {
            guildId: data.guild_id,
            channelId: null,
            userId: data.user_id,
          })
        }
        break
    }
  })

  // Connect to Discord Gateway
  await gateway.connect()

  // Start health check server
  const healthServer = createServer((req, res) => {
    if (req.url === '/health') {
      const state = gateway.getState()
      const healthy = state === 'CONNECTED'

      res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          status: healthy ? 'ok' : 'unhealthy',
          state,
          timestamp: new Date().toISOString(),
        }),
      )
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  healthServer.listen(config.port, () => {
    console.log(`[Worker] Health check server listening on port ${config.port}`)
    console.log(
      `[Worker] Health check endpoint: http://localhost:${config.port}/health`,
    )
  })

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('[Worker] Received SIGINT, shutting down...')
    gateway.disconnect()
    healthServer.close()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('[Worker] Received SIGTERM, shutting down...')
    gateway.disconnect()
    healthServer.close()
    process.exit(0)
  })
}

// Run
main().catch((error) => {
  console.error('[Worker] Fatal error:', error)
  process.exit(1)
})
