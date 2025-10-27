import { z } from 'zod'

// ============================================================================
// HTTP Request/Response Schemas
// ============================================================================

export const CreateRoomRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().regex(/^\d+$/).optional(),
  userLimit: z.number().int().min(0).max(99).default(4),
})

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>

export const CreateRoomResponseSchema = z.object({
  channelId: z.string().regex(/^\d+$/),
  name: z.string(),
  guildId: z.string().regex(/^\d+$/),
})

export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>

export const DeleteRoomResponseSchema = z.object({
  ok: z.literal(true),
})

export type DeleteRoomResponse = z.infer<typeof DeleteRoomResponseSchema>

// ============================================================================
// WebSocket Schemas
// ============================================================================

export const WSAuthMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string().min(1),
})

export type WSAuthMessage = z.infer<typeof WSAuthMessageSchema>

export const VoiceStateSchema = z.object({
  guildId: z.string().regex(/^\d+$/),
  channelId: z.string().regex(/^\d+$/).nullable(),
  userId: z.string().regex(/^\d+$/),
  sessionId: z.string().optional(),
  deaf: z.boolean().optional(),
  mute: z.boolean().optional(),
  selfDeaf: z.boolean().optional(),
  selfMute: z.boolean().optional(),
  selfVideo: z.boolean().optional(),
  suppress: z.boolean().optional(),
})

export type VoiceState = z.infer<typeof VoiceStateSchema>

// ============================================================================
// Internal Event Schemas
// ============================================================================

export const InternalEventSchema = z.object({
  event: z.enum(['room.created', 'room.deleted', 'voice.joined', 'voice.left']),
  payload: z.unknown(), // Will be validated by specific payload schemas
})

export type InternalEvent = z.infer<typeof InternalEventSchema>
