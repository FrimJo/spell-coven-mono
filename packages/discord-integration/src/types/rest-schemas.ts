/**
 * Zod schemas for Discord REST API requests and responses
 * Based on discord-api-types but with runtime validation
 */

import { z } from 'zod'

// ============================================================================
// Channel Schemas
// ============================================================================

export const CreateVoiceChannelRequestSchema = z.object({
  name: z.string().min(1).max(100),
  parent_id: z.string().regex(/^\d+$/).optional(),
  user_limit: z.number().int().min(0).max(99).optional(),
  position: z.number().int().optional(),
  permission_overwrites: z.array(z.unknown()).optional(),
  rtc_region: z.string().optional(),
  video_quality_mode: z.number().int().min(1).max(2).optional(), // 1 = auto, 2 = 720p
  bitrate: z.number().int().min(8000).max(96000).optional(),
})

export type CreateVoiceChannelRequest = z.infer<
  typeof CreateVoiceChannelRequestSchema
>

export const ChannelResponseSchema = z.object({
  id: z.string(),
  type: z.number(),
  guild_id: z.string().optional(),
  position: z.number().optional(),
  permission_overwrites: z.array(z.unknown()).optional(),
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
