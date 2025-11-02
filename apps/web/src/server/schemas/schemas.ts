import { z } from 'zod'

const SnowflakeRegex = /^\d+$/

export const SnowflakeSchema = z
  .string()
  .regex(SnowflakeRegex, 'Expected Discord snowflake ID')

export const DiscordPermissionOverwriteSchema = z.object({
  id: SnowflakeSchema,
  type: z.union([z.literal(0), z.literal(1)]),
  allow: z.string().regex(SnowflakeRegex),
  deny: z.string().regex(SnowflakeRegex),
})

export const DiscordRoleSummarySchema = z.object({
  id: SnowflakeSchema,
  name: z.string().min(1).max(100),
  position: z.number().int(),
  permissions: z.string().regex(SnowflakeRegex),
  managed: z.boolean(),
})

export const DiscordChannelSummarySchema = z.object({
  id: SnowflakeSchema,
  guildId: SnowflakeSchema,
  name: z.string().min(1).max(100),
  type: z.number().int(),
  parentId: SnowflakeSchema.nullable().optional(),
  permissionOverwrites: z.array(DiscordPermissionOverwriteSchema).optional(),
  rtcRegion: z.string().nullable().optional(),
  userLimit: z.number().int().min(0).max(99).optional(),
})

export const DiscordVoiceStateSchema = z.object({
  guild_id: SnowflakeSchema,
  channel_id: SnowflakeSchema.nullable(),
  user_id: SnowflakeSchema,
  session_id: z.string().optional(),
})

export const RoomTokenErrorCodeSchema = z.enum([
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'ROOM_FULL',
])

export type RoomTokenErrorCode = z.infer<typeof RoomTokenErrorCodeSchema>

export const RoomInviteClaimsSchema = z.object({
  v: z.literal(1),
  purpose: z.literal('voice-room'),
  guild_id: SnowflakeSchema,
  channel_id: SnowflakeSchema,
  role_id: SnowflakeSchema,
  creator_id: SnowflakeSchema,
  max_seats: z.number().int().positive().optional(),
  room_name: z.string().min(1).max(100).optional(),
  jti: z.string().min(4).max(128).optional(),
  iat: z.number().int(),
  exp: z.number().int(),
})

export type RoomInviteClaims = z.infer<typeof RoomInviteClaimsSchema>

export const RoomInviteMetadataSchema = z.object({
  token: z.string().min(16),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
})

export const DiscordDeepLinkSchema = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith('https://discord.com/channels/'),
    'Expected Discord deep link',
  )

// ============================================================================
// HTTP Request/Response Schemas
// ============================================================================

const UrlSchema = z.string().url('Expected absolute URL')

export const RoomSummarySchema = z.object({
  guildId: SnowflakeSchema,
  channelId: SnowflakeSchema,
  roleId: SnowflakeSchema,
  name: z.string().min(1).max(100),
  userLimit: z.number().int().min(0).max(99).nullable().optional(),
  permissionOverwrites: z.array(DiscordPermissionOverwriteSchema),
  deepLink: DiscordDeepLinkSchema,
})

export type RoomSummary = z.infer<typeof RoomSummarySchema>

export const RoomInviteDetailsSchema = RoomInviteMetadataSchema.extend({
  shareUrl: UrlSchema,
  maxSeats: z.number().int().positive().optional(),
})

export type RoomInviteDetails = z.infer<typeof RoomInviteDetailsSchema>

export const CreateRoomRequestSchema = z.object({
  creatorId: SnowflakeSchema,
  name: z.string().min(1).max(100).optional(),
  parentId: SnowflakeSchema.optional(),
  // 4-player limit per spec requirement
  userLimit: z.number().int().min(1).max(4).default(4),
  maxSeats: z.number().int().min(1).max(4).optional(),
  // 24-hour token expiry per spec requirement (86400 seconds = 24 hours)
  tokenTtlSeconds: z
    .number()
    .int()
    .min(60)
    .max(86400)
    .default(86400),
  shareUrlBase: UrlSchema,
  includeCreatorOverwrite: z.boolean().default(true),
})

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>

export const CreateRoomResponseSchema = z.object({
  room: RoomSummarySchema,
  invite: RoomInviteDetailsSchema,
})

export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>

export const RefreshRoomInviteRequestSchema = z.object({
  channelId: SnowflakeSchema,
  roleId: SnowflakeSchema,
  creatorId: SnowflakeSchema,
  shareUrlBase: UrlSchema,
  // 4-player limit per spec requirement
  maxSeats: z.number().int().min(1).max(4).optional(),
  // 24-hour token expiry per spec requirement (86400 seconds = 24 hours)
  tokenTtlSeconds: z
    .number()
    .int()
    .min(60)
    .max(86400)
    .default(86400),
})

export type RefreshRoomInviteRequest = z.infer<
  typeof RefreshRoomInviteRequestSchema
>

export const RefreshRoomInviteResponseSchema = CreateRoomResponseSchema

export type RefreshRoomInviteResponse = z.infer<
  typeof RefreshRoomInviteResponseSchema
>

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
  guildId: SnowflakeSchema,
  channelId: SnowflakeSchema.nullable(),
  userId: SnowflakeSchema,
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

export const JoinRoomRequestSchema = z.object({
  token: z.string().min(10),
  userId: SnowflakeSchema,
  accessToken: z.string().min(10),
})

export const JoinRoomResponseSchema = z.object({
  room: RoomSummarySchema,
})

export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>
export type JoinRoomResponse = z.infer<typeof JoinRoomResponseSchema>
