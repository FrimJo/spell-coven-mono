import { z } from 'zod'

/**
 * SSE Message Types (Client-Side)
 *
 * These types define the structure of Server-Sent Events messages
 * received by the browser from the /api/stream endpoint.
 */

/**
 * Base SSE message structure
 */
export const SSEMessageBaseSchema = z.object({
  v: z.literal(1), // Protocol version
  ts: z.number(), // Timestamp
})

/**
 * SSE Custom Event Message - Application-specific events
 */
export const SSECustomEventMessageSchema = z.discriminatedUnion('event', [
  SSEMessageBaseSchema.extend({
    type: z.literal('custom.event'),
    event: z.enum(['voice.joined']),
    payload: z.object({
      guildId: z.string(),
      channelId: z.string(),
      userId: z.string(),
      username: z.string(),
      avatar: z.string().optional(),
    }),
  }),
  SSEMessageBaseSchema.extend({
    type: z.literal('custom.event'),
    event: z.enum(['voice.left']),
    payload: z.object({
      guildId: z.string(),
      channelId: z.string(),
      userId: z.string(),
    }),
  }),
  SSEMessageBaseSchema.extend({
    type: z.literal('custom.event'),
    event: z.enum(['users.connection_status']),
    payload: z.object({
      connectedUserIds: z.array(z.string()),
      timestamp: z.number(),
    }),
  }),
])

export type SSECustomEventMessage = z.infer<typeof SSECustomEventMessageSchema>

/**
 * SSE Acknowledgment Message - Connection established
 */
export const SSEAckMessageSchema = SSEMessageBaseSchema.extend({
  type: z.literal('ack'),
  event: z.literal('connected'),
  message: z.string().optional(),
})

export type SSEAckMessage = z.infer<typeof SSEAckMessageSchema>

/**
 * SSE Error Message - Error notification
 */
export const SSEErrorMessageSchema = SSEMessageBaseSchema.extend({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
})

export type SSEErrorMessage = z.infer<typeof SSEErrorMessageSchema>

/**
 * SSE WebRTC Signaling Message - WebRTC signaling events
 */
export const SSEWebRTCSignalingMessageSchema = SSEMessageBaseSchema.extend({
  type: z.literal('webrtc-signaling'),
  event: z.literal('signaling-message'),
  data: z.object({
    from: z.string(),
    roomId: z.string(),
    message: z.object({
      type: z.enum(['offer', 'answer', 'ice-candidate', 'track-state']),
      payload: z.unknown(),
    }),
  }),
})

export type SSEWebRTCSignalingMessage = z.infer<
  typeof SSEWebRTCSignalingMessageSchema
>

/**
 * Discriminated union of all SSE message types
 */
export const SSEMessageSchema = z.discriminatedUnion('type', [
  SSECustomEventMessageSchema,
  SSEAckMessageSchema,
  SSEErrorMessageSchema,
  SSEWebRTCSignalingMessageSchema,
])

export type SSEMessage = z.infer<typeof SSEMessageSchema>

/**
 * Type guards
 */
export function isSSECustomEventMessage(
  msg: SSEMessage,
): msg is SSECustomEventMessage {
  return msg.type === 'custom.event'
}

export function isSSEAckMessage(msg: SSEMessage): msg is SSEAckMessage {
  return msg.type === 'ack'
}

export function isSSEErrorMessage(msg: SSEMessage): msg is SSEErrorMessage {
  return msg.type === 'error'
}

export function isSSEWebRTCSignalingMessage(
  msg: SSEMessage,
): msg is SSEWebRTCSignalingMessage {
  return msg.type === 'webrtc-signaling'
}

/**
 * Voice event payloads (custom events)
 */
export interface VoiceLeftEventPayload {
  guildId: string
  channelId: null
  userId: string
}

export interface VoiceJoinedEventPayload {
  guildId: string
  channelId: string
  userId: string
  username: string
  avatar: string | null
}
