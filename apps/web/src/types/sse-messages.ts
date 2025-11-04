import { z } from 'zod'

import type { GatewayDispatchEvents } from '@repo/discord-integration/types'

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
 * SSE Discord Gateway Event Message - Raw Discord events
 */
export const SSEDiscordEventMessageSchema = SSEMessageBaseSchema.extend({
  type: z.literal('discord.event'),
  event: z.string().transform((event) => event as GatewayDispatchEvents), // Transform to GatewayDispatchEvents
  payload: z.unknown(), // Raw Discord event payload GatewaySendPayload
})

export type SSEDiscordEventMessage = z.infer<
  typeof SSEDiscordEventMessageSchema
>

/**
 * SSE Custom Event Message - Application-specific events
 */
export const SSECustomEventMessageSchema = SSEMessageBaseSchema.extend({
  type: z.literal('custom.event'),
  event: z.enum(['voice.joined', 'voice.left']), // Custom event names
  payload: z.unknown(), // Custom event payload
})

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
 * Discriminated union of all SSE message types
 */
export const SSEMessageSchema = z.discriminatedUnion('type', [
  SSEDiscordEventMessageSchema,
  SSECustomEventMessageSchema,
  SSEAckMessageSchema,
  SSEErrorMessageSchema,
])

export type SSEMessage = z.infer<typeof SSEMessageSchema>

/**
 * Type guards
 */
export function isSSEDiscordEventMessage(
  msg: SSEMessage,
): msg is SSEDiscordEventMessage {
  return msg.type === 'discord.event'
}

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
