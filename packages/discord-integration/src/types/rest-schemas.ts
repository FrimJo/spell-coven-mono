/**
 * Zod schemas for Discord REST API requests and responses
 * Based on discord-api-types but with runtime validation
 */

import { z } from 'zod'

const SnowflakeSchema = z.string().regex(/^\d+$/)

// ============================================================================
// Channel Schemas
// ============================================================================

export const PermissionOverwriteSchema = z.object({
  id: SnowflakeSchema,
  type: z.union([z.literal(0), z.literal(1)]),
  allow: z.string().regex(/^\d+$/),
  deny: z.string().regex(/^\d+$/),
})

export const CreateVoiceChannelRequestSchema = z.object({
  name: z.string().min(1).max(100),
  parent_id: SnowflakeSchema.optional(),
  user_limit: z.number().int().min(0).max(99).optional(),
  position: z.number().int().optional(),
  permission_overwrites: z.array(PermissionOverwriteSchema).optional(),
  rtc_region: z.string().optional(),
  video_quality_mode: z.number().int().min(1).max(2).optional(), // 1 = auto, 2 = 720p
  bitrate: z.number().int().min(8000).max(96000).optional(),
})

export type CreateVoiceChannelRequest = z.infer<
  typeof CreateVoiceChannelRequestSchema
>

export const UserSchema = z.object({
  id: SnowflakeSchema,
  username: z.string(),
  discriminator: z.string(),
  avatar: z.string().nullable(),
})

export const GuildMemberSchema = z.object({
  user: UserSchema.optional(),
  nick: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  roles: z.array(SnowflakeSchema),
  joined_at: z.string(),
  premium_since: z.string().nullable().optional(),
  deaf: z.boolean().optional(),
  mute: z.boolean().optional(),
  pending: z.boolean().optional(),
  communication_disabled_until: z.string().nullable().optional(),
})

export type GuildMember = z.infer<typeof GuildMemberSchema>

export const RoleSchema = z.object({
  id: SnowflakeSchema,
  name: z.string().min(1).max(100),
  color: z.number().int().min(0).max(0xffffff),
  hoist: z.boolean(),
  icon: z.string().nullable().optional(),
  unicode_emoji: z.string().nullable().optional(),
  position: z.number().int(),
  permissions: z.string().regex(/^\d+$/),
  managed: z.boolean(),
  mentionable: z.boolean(),
  flags: z.number().int().optional(),
  tags: z
    .object({
      bot_id: SnowflakeSchema.optional(),
      integration_id: SnowflakeSchema.optional(),
      premium_subscriber: z.null().optional(),
    })
    .optional(),
})

export type Role = z.infer<typeof RoleSchema>

export const ChannelResponseSchema = z.object({
  id: SnowflakeSchema,
  type: z.number(),
  guild_id: SnowflakeSchema.optional(),
  position: z.number().optional(),
  permission_overwrites: z.array(PermissionOverwriteSchema).optional(),
  name: z.string(),
  topic: z.string().nullable().optional(),
  nsfw: z.boolean().optional(),
  last_message_id: z.string().nullable().optional(),
  bitrate: z.number().optional(),
  user_limit: z.number().optional(),
  rate_limit_per_user: z.number().optional(),
  recipients: z.array(z.unknown()).optional(),
  icon: z.string().nullable().optional(),
  owner_id: z.string().optional(),
  application_id: z.string().optional(),
  parent_id: z.string().nullable().optional(),
  last_pin_timestamp: z.string().nullable().optional(),
  rtc_region: z.string().nullable().optional(),
  video_quality_mode: z.number().optional(),
  message_count: z.number().optional(),
  member_count: z.number().optional(),
  thread_metadata: z.unknown().optional(),
  member: z.unknown().optional(),
  default_auto_archive_duration: z.number().optional(),
  permissions: z.string().optional(),
  flags: z.number().optional(),
})

export type ChannelResponse = z.infer<typeof ChannelResponseSchema>

export const VoiceStateSchema = z.object({
  guild_id: SnowflakeSchema,
  channel_id: SnowflakeSchema.nullable(),
  user_id: SnowflakeSchema,
  session_id: z.string(),
  deaf: z.boolean().optional(),
  mute: z.boolean().optional(),
  self_deaf: z.boolean().optional(),
  self_mute: z.boolean().optional(),
  suppress: z.boolean().optional(),
})

export type VoiceState = z.infer<typeof VoiceStateSchema>

// ============================================================================
// Message Schemas
// ============================================================================

export const SendMessageRequestSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  nonce: z.union([z.string(), z.number()]).optional(),
  tts: z.boolean().optional(),
  embeds: z.array(z.unknown()).optional(),
  allowed_mentions: z.unknown().optional(),
  message_reference: z.unknown().optional(),
  components: z.array(z.unknown()).optional(),
  sticker_ids: z.array(z.string()).optional(),
  files: z.array(z.unknown()).optional(),
  attachments: z.array(z.unknown()).optional(),
  flags: z.number().optional(),
})

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>

export const MessageResponseSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  author: z.unknown(),
  content: z.string(),
  timestamp: z.string(),
  edited_timestamp: z.string().nullable(),
  tts: z.boolean(),
  mention_everyone: z.boolean(),
  mentions: z.array(z.unknown()),
  mention_roles: z.array(z.string()),
  mention_channels: z.array(z.unknown()).optional(),
  attachments: z.array(z.unknown()),
  embeds: z.array(z.unknown()),
  reactions: z.array(z.unknown()).optional(),
  nonce: z.union([z.string(), z.number()]).optional(),
  pinned: z.boolean(),
  webhook_id: z.string().optional(),
  type: z.number(),
  activity: z.unknown().optional(),
  application: z.unknown().optional(),
  application_id: z.string().optional(),
  message_reference: z.unknown().optional(),
  flags: z.number().optional(),
  referenced_message: z.unknown().nullable().optional(),
  interaction: z.unknown().optional(),
  thread: z.unknown().optional(),
  components: z.array(z.unknown()).optional(),
  sticker_items: z.array(z.unknown()).optional(),
  position: z.number().optional(),
})

export type MessageResponse = z.infer<typeof MessageResponseSchema>

// ============================================================================
// Guild Schemas
// ============================================================================

export const GuildChannelListResponseSchema = z.array(ChannelResponseSchema)

export type GuildChannelListResponse = z.infer<
  typeof GuildChannelListResponseSchema
>

export const GuildRoleListResponseSchema = z.array(RoleSchema)

export type GuildRoleListResponse = z.infer<typeof GuildRoleListResponseSchema>

export const CreateRoleRequestSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.string().regex(/^\d+$/).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  unicode_emoji: z.string().nullable().optional(),
})

export type CreateRoleRequest = z.infer<typeof CreateRoleRequestSchema>

export const AddGuildMemberRequestSchema = z.object({
  access_token: z.string(),
  nick: z.string().max(32).optional(),
  roles: z.array(SnowflakeSchema).optional(),
  mute: z.boolean().optional(),
  deaf: z.boolean().optional(),
  channel_id: SnowflakeSchema.optional(),
})

export type AddGuildMemberRequest = z.infer<typeof AddGuildMemberRequestSchema>

// ============================================================================
// Error Schemas
// ============================================================================

export const DiscordErrorResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  errors: z.unknown().optional(),
})

export type DiscordErrorResponse = z.infer<typeof DiscordErrorResponseSchema>

// ============================================================================
// Rate Limit Schemas
// ============================================================================

export const RateLimitResponseSchema = z.object({
  message: z.string(),
  retry_after: z.number(),
  global: z.boolean(),
  code: z.number().optional(),
})

export type RateLimitResponse = z.infer<typeof RateLimitResponseSchema>
