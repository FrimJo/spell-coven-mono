import type { GatewayDispatchEvents } from 'discord-api-types/v10'
import { z } from 'zod'

/**
 * Gateway Service WebSocket Protocol
 *
 * This defines the message format used by the Gateway Service's WebSocket server
 * when communicating with the TanStack Start backend.
 */

/**
 * Event message - Discord Gateway event forwarded to clients
 */
export const GatewayServiceEventMessageSchema = z.object({
  type: z.literal('event'),
  data: z.object({
    event: z.string().transform((event) => event as GatewayDispatchEvents), // GatewayDispatchEvents type at runtime
    payload: z.unknown(), // Raw Discord event payload
  }),
  ts: z.number(),
})

export type GatewayServiceEventMessage = z.infer<
  typeof GatewayServiceEventMessageSchema
>

/**
 * Command message - Client sending command to Gateway Service
 */
export const GatewayServiceCommandMessageSchema = z.object({
  type: z.literal('command'),
  data: z.object({
    command: z.string(),
    payload: z.unknown(),
  }),
  requestId: z.string().optional(),
  ts: z.number(),
})

export type GatewayServiceCommandMessage = z.infer<
  typeof GatewayServiceCommandMessageSchema
>

/**
 * Acknowledgment message - Gateway Service confirming receipt
 */
export const GatewayServiceAckMessageSchema = z.object({
  type: z.literal('ack'),
  data: z.unknown(),
  requestId: z.string().optional(),
  ts: z.number(),
})

export type GatewayServiceAckMessage = z.infer<
  typeof GatewayServiceAckMessageSchema
>

/**
 * Error message - Gateway Service reporting error
 */
export const GatewayServiceErrorMessageSchema = z.object({
  type: z.literal('error'),
  data: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
  requestId: z.string().optional(),
  ts: z.number(),
})

export type GatewayServiceErrorMessage = z.infer<
  typeof GatewayServiceErrorMessageSchema
>

/**
 * Discriminated union of all Gateway Service message types
 */
export const GatewayServiceMessageSchema = z.discriminatedUnion('type', [
  GatewayServiceEventMessageSchema,
  GatewayServiceCommandMessageSchema,
  GatewayServiceAckMessageSchema,
  GatewayServiceErrorMessageSchema,
])

export type GatewayServiceMessage = z.infer<typeof GatewayServiceMessageSchema>

/**
 * Type guard for event messages
 */
export function isEventMessage(
  msg: GatewayServiceMessage,
): msg is GatewayServiceEventMessage {
  return msg.type === 'event'
}

/**
 * Type guard for command messages
 */
export function isCommandMessage(
  msg: GatewayServiceMessage,
): msg is GatewayServiceCommandMessage {
  return msg.type === 'command'
}

/**
 * Type guard for ack messages
 */
export function isAckMessage(
  msg: GatewayServiceMessage,
): msg is GatewayServiceAckMessage {
  return msg.type === 'ack'
}

/**
 * Type guard for error messages
 */
export function isErrorMessage(
  msg: GatewayServiceMessage,
): msg is GatewayServiceErrorMessage {
  return msg.type === 'error'
}
