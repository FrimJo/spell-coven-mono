import { env } from '@/env'
import { createServerOnlyFn } from '@tanstack/react-start'
import { WebSocket } from 'ws'

import type { GatewayServiceMessage } from '@repo/discord-integration/types'
import {
  GatewayServiceMessageSchema,
  isAckMessage,
  isErrorMessage,
  isEventMessage,
} from '@repo/discord-integration/types'

import { sseManager } from '../managers/sse-manager.js'

/**
 * Gateway Client Initialization
 *
 * Connects to the Discord Gateway Service via WebSocket and forwards
 * events to SSE clients.
 */

let ws: WebSocket | null = null
let isInitialized = false
let reconnectTimeout: NodeJS.Timeout | null = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 10

/**
 * Connect to Gateway Service
 */
function connectToGateway(): void {
  const gatewayUrl = env.GATEWAY_WS_URL
  const linkToken = env.LINK_TOKEN
  const guildId = env.VITE_DISCORD_GUILD_ID

  if (!gatewayUrl) {
    console.error(
      '[Gateway Client] Missing GATEWAY_WS_URL environment variable',
    )
    return
  }

  if (!linkToken) {
    console.error('[Gateway Client] Missing LINK_TOKEN environment variable')
    return
  }

  if (!guildId) {
    console.error(
      '[Gateway Client] Missing VITE_DISCORD_GUILD_ID environment variable',
    )
    return
  }

  console.log(`[Gateway Client] Connecting to ${gatewayUrl}...`)

  // Create WebSocket connection with authentication header
  ws = new WebSocket(gatewayUrl, {
    headers: {
      Authorization: `Bearer ${linkToken}`,
    },
  })

  ws.on('open', () => {
    console.log('[Gateway Client] Connected to Gateway Service')
    reconnectAttempts = 0
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  })

  ws.on('message', (data: Buffer) => {
    try {
      const parsed = JSON.parse(data.toString())

      // Validate message with Zod schema
      const result = GatewayServiceMessageSchema.safeParse(parsed)

      if (!result.success) {
        console.error('[Gateway Client] Invalid message format:', result.error)
        return
      }

      const message = result.data

      // Handle acknowledgment messages
      if (isAckMessage(message)) {
        console.log('[Gateway Client] Received ack:', message.data)
        return
      }

      // Handle error messages
      if (isErrorMessage(message)) {
        console.error(
          '[Gateway Client] Received error:',
          message.data.message,
          message.data.code,
        )
        return
      }

      // Handle Discord events
      if (isEventMessage(message)) {
        const { event, payload } = message.data

        console.log(`[Gateway Client] Received Discord event: ${event}`)

        // Forward raw Discord Gateway event to SSE clients
        sseManager.broadcastDiscordEventToGuild(guildId, event, payload)
      }
    } catch (error) {
      console.error('[Gateway Client] Failed to parse message:', error)
    }
  })

  ws.on('close', (code, reason) => {
    console.log(
      `[Gateway Client] Connection closed: ${code} ${reason.toString()}`,
    )
    ws = null

    // Attempt reconnection with exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
      reconnectAttempts++
      console.log(
        `[Gateway Client] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
      )
      reconnectTimeout = setTimeout(() => {
        connectToGateway()
      }, delay)
    } else {
      console.error(
        '[Gateway Client] Max reconnection attempts reached. Giving up.',
      )
    }
  })

  ws.on('error', (error) => {
    console.error('[Gateway Client] WebSocket error:', error)
  })
}

/**
 * Send command to Gateway Service
 */
export function sendGatewayCommand(
  command: string,
  payload: unknown,
  requestId?: string,
): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn(
      '[Gateway Client] Cannot send command: not connected to Gateway Service',
    )
    return
  }

  const message: GatewayServiceMessage = {
    type: 'command',
    data: { command, payload },
    requestId,
    ts: Date.now(),
  }

  ws.send(JSON.stringify(message))
  console.log(`[Gateway Client] Sent command: ${command}`)
}

/**
 * Get connection status
 */
export function getGatewayStatus(): {
  connected: boolean
  reconnectAttempts: number
} {
  return {
    connected: ws?.readyState === WebSocket.OPEN,
    reconnectAttempts,
  }
}

/**
 * Disconnect from Gateway Service
 */
export function disconnectGateway(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  if (ws) {
    ws.close(1000, 'Client disconnect')
    ws = null
  }

  console.log('[Gateway Client] Disconnected from Gateway Service')
}

/**
 * Initialize Gateway Client
 */
export const initializeGatewayClient = createServerOnlyFn(async () => {
  if (isInitialized) {
    console.log('[Gateway Client] Already initialized')
    return
  }

  try {
    console.log('[Gateway Client] Starting Gateway client initialization...')

    // Connect to Gateway Service
    connectToGateway()

    isInitialized = true
    console.log('[Gateway Client] Gateway client initialized successfully')
  } catch (error) {
    console.error(
      '[Gateway Client] Failed to initialize Gateway client:',
      error,
    )
    throw error
  }
})
