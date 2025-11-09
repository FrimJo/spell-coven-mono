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

      // Check if target user has active SSE connection
      if (!sseManager.hasUserConnection(to)) {
        return {
          success: false,
          error: `Target player ${to} not found or not connected`,
        }
      }

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

      // Route message to target player via SSE
      const sent = sseManager.sendToUser(to, sseMessage)

      if (!sent) {
        return {
          success: false,
          error: `Failed to send message to player ${to}`,
        }
      }

      console.log(
        `[WebRTC Signaling] Routed ${message.type} message from room ${roomId} to player ${to}`,
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
