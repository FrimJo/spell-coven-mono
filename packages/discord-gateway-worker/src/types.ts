import { z } from 'zod'

// ============================================================================
// Message Envelope
// ============================================================================

export const MessageEnvelopeSchema = z.object({
  v: z.literal(1), // Protocol version
  type: z.enum(['event', 'ack', 'error']),
  event: z.string().optional(),
  payload: z.unknown(),
  ts: z.number().int().positive(), // Unix timestamp (ms)
})

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>

// ============================================================================
// Event Payloads
// ============================================================================

export const RoomCreatedPayloadSchema = z.object({
  channelId: z.string().regex(/^\d+$/),
  name: z.string(),
  guildId: z.string().regex(/^\d+$/),
  parentId: z.string().regex(/^\d+$/).optional(),
  userLimit: z.number().int().min(0).max(99),
})

export type RoomCreatedPayload = z.infer<typeof RoomCreatedPayloadSchema>

export const RoomDeletedPayloadSchema = z.object({
  channelId: z.string().regex(/^\d+$/),
  guildId: z.string().regex(/^\d+$/),
})

export type RoomDeletedPayload = z.infer<typeof RoomDeletedPayloadSchema>

export const VoiceJoinedPayloadSchema = z.object({
  guildId: z.string().regex(/^\d+$/),
  channelId: z.string().regex(/^\d+$/),
  userId: z.string().regex(/^\d+$/),
})

export type VoiceJoinedPayload = z.infer<typeof VoiceJoinedPayloadSchema>

export const VoiceLeftPayloadSchema = z.object({
  guildId: z.string().regex(/^\d+$/),
  channelId: z.string().regex(/^\d+$/).nullable(),
  userId: z.string().regex(/^\d+$/),
})

export type VoiceLeftPayload = z.infer<typeof VoiceLeftPayloadSchema>

// ============================================================================
// Internal Event (Worker → TanStack Start)
// ============================================================================

export const InternalEventSchema = z.object({
  event: z.enum(['room.created', 'room.deleted', 'voice.joined', 'voice.left']),
  payload: z.union([
    RoomCreatedPayloadSchema,
    RoomDeletedPayloadSchema,
    VoiceJoinedPayloadSchema,
    VoiceLeftPayloadSchema,
  ]),
})

export type InternalEvent = z.infer<typeof InternalEventSchema>

// ============================================================================
// Discord API Types
// ============================================================================

export const VoiceChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.number(),
  guild_id: z.string(),
  parent_id: z.string().optional(),
  user_limit: z.number().optional(),
})

export type VoiceChannel = z.infer<typeof VoiceChannelSchema>

// ============================================================================
// Discord Gateway Types
// ============================================================================

export interface GatewayConfig {
  port: number
  botToken: string
  primaryGuildId: string
  hubEndpoint: string
  hubSecret: string
}

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'IDENTIFYING'
  | 'CONNECTED'
  | 'RECONNECTING'

export interface GatewaySession {
  sessionId: string | null
  sequenceNumber: number | null
  resumeUrl: string | null
}
