/**
 * WebRTC Signaling Server Functions
 * Handles routing of WebRTC signaling messages between players via SSE
 */

import type { SignalingMessageRequest } from '@/lib/webrtc/signaling.js'
import { SignalingMessageRequestSchema } from '@/lib/webrtc/signaling.js'
import { createServerFn } from '@tanstack/react-start'

import { sseManager } from '../managers/sse-manager.js'

/**
 * Send WebRTC signaling message to target player
 * Routes messages via SSE to enable peer-to-peer WebRTC connections
 */
export const sendSignalingMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    const result = SignalingMessageRequestSchema.safeParse(data)
    if (!result.success) {
      throw new Error(`Invalid request: ${result.error.message}`)
    }
    return result.data
  })
  .handler(async ({ data }: { data: SignalingMessageRequest }) => {
    try {
      const { roomId, from, to, message } = data

      // Validate that from and to are different
      if (from === to) {
        return {
          success: false,
          error: 'Cannot send signaling message to self',
        }
      }

      console.log(
        `[WebRTC Signaling] Attempting to send ${message.type} from ${from} to ${to} in room ${roomId}`,
      )

      // Check if target user has active SSE connection
      if (!sseManager.hasUserConnection(to)) {
        console.warn(
          `[WebRTC Signaling] Target player ${to} not found in SSE manager`,
        )
        return {
          success: false,
          error: `Target player ${to} not found or not connected`,
        }
      }

      console.log(`[WebRTC Signaling] Target ${to} has active SSE connection`)

      // Create SSE message format (matches contracts/signaling-api.md)
      const sseMessage = `data: ${JSON.stringify({
        v: 1,
        type: 'webrtc-signaling',
        event: 'signaling-message',
        ts: Date.now(),
        data: {
          from,
          roomId,
          message: {
            type: message.type,
            payload: message.payload,
          },
        },
      })}\n\n`

      console.log(
        `[WebRTC Signaling] Sending SSE message to ${to}:`,
        message.type,
      )

      // Route message to target player via SSE
      const sent = sseManager.sendToUser(to, sseMessage)

      if (!sent) {
        console.error(
          `[WebRTC Signaling] sendToUser returned false for ${to}`,
        )
        return {
          success: false,
          error: `Failed to send message to player ${to}`,
        }
      }

      console.log(
        `[WebRTC Signaling] Successfully routed ${message.type} message from room ${roomId} to player ${to}`,
      )

      return { success: true }
    } catch (error) {
      console.error('[WebRTC Signaling] Error routing message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }
    }
  })
